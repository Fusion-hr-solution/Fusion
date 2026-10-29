using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Opt-in local transport acceptance; uses only a unique synthetic mailbox and cleans that mail.</summary>
public sealed class NotificationSmtpTests
{
    [MailpitFact]
    public async Task Submitted_plan_commits_one_notification_and_delivers_safe_shell_link_to_mailpit()
    {
        var mailpitUrl = Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_MAILPIT_TEST_URL")!;
        Assert.True(Uri.TryCreate(mailpitUrl, UriKind.Absolute, out var uri) && uri.IsLoopback);
        using var mailpit = new HttpClient { BaseAddress = new Uri(mailpitUrl), Timeout = TimeSpan.FromSeconds(10) };
        await using var factory = new PerformanceApiFactory();
        var marker = Guid.NewGuid().ToString("N");
        var manager = factory.Core.Add("Notification QA reviewer");
        var employee = factory.Core.Add("Notification QA employee", managerId: manager.EmployeeId);
        var email = $"notification-qa-{marker}@performance.test";
        factory.Core.ById[manager.EmployeeId] = manager with { WorkEmail = email };
        var start = new DateOnly(2026, 1, 1); var end = new DateOnly(2026, 12, 31);
        var cycle = PerformanceCycle.CreateDraft(factory.Store.TenantId, "Notification QA", start, end, start.AddDays(30)).Activated();
        var participant = Participant.Create(factory.Store.TenantId, cycle.Id, employee.EmployeeId, employee.DisplayName,
            null, null, null, manager.EmployeeId, manager.DisplayName, false, start);
        var plan = EmployeePlan.Create(factory.Store.TenantId, cycle.Id, participant.Id, employee.EmployeeId,
            employee.DisplayName, null, manager.EmployeeId, manager.DisplayName);
        var direction = Objective.CreateStrategic(factory.Store.TenantId, cycle.Id, "Direction", null, manager.EmployeeId,
            start, end, ObjectiveMeasurement.ManualPercentage(), start, end);
        direction.Publish();
        var objective = Objective.CreateEmployee(factory.Store.TenantId, cycle.Id, plan.Id, employee.EmployeeId,
            "Deliver", null, direction.Id, start, end, ObjectiveMeasurement.ManualPercentage(), 100m, start, end, start, end);
        await using (var db = factory.Store.NewContext())
        {
            db.Cycles.Add(cycle); db.Participants.Add(participant); db.EmployeePlans.Add(plan);
            db.Objectives.AddRange(direction, objective); await db.SaveChangesAsync();
        }
        List<string> messageIds = [];
        try
        {
            using var client = factory.CreateAuthenticatedClient(employeeId: employee.EmployeeId,
                permissions: [new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self), new(PerformancePermissions.CycleView, PermissionScopes.Self)]);
            using var response = await client.PostAsJsonAsync($"/api/performance/cycles/{cycle.Id}/plan/submit", new { expectedVersion = plan.Version });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var retry = await client.PostAsJsonAsync($"/api/performance/cycles/{cycle.Id}/plan/submit", new { expectedVersion = plan.Version });
            Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
            var options = Options.Create(new PerformanceNotificationOptions
            {
                Enabled = true, ShellBaseUrl = "http://localhost:3000",
                Smtp = new() { Host = "localhost", Port = 1025, From = "performance@fusion.local", UseSsl = false },
            });
            await using (var db = factory.Store.NewContext())
            {
                Assert.Equal(PlanLifecycleState.Submitted, (await db.EmployeePlans.SingleAsync()).State);
                var message = Assert.Single(await db.OutboxMessages.ToListAsync());
                var dispatcher = new PerformanceNotificationDispatcher(db, factory.Store.Tenant, factory.Core, factory.Audience,
                    new SmtpPerformanceNotificationSender(options), options);
                await dispatcher.DispatchAsync(message, DateTime.UtcNow, default);
                await dispatcher.DispatchAsync(message, DateTime.UtcNow, default);
                Assert.NotNull(message.DispatchedAt);
            }
            var query = $"/api/v1/search?query={Uri.EscapeDataString(email)}";
            JsonElement matches = default;
            for (var attempt = 0; attempt < 10; attempt++)
            {
                matches = await mailpit.GetFromJsonAsync<JsonElement>(query);
                messageIds = matches.GetProperty("messages").EnumerateArray().Select(m => m.GetProperty("ID").GetString()!).ToList();
                if (messageIds.Count > 0) break;
                await Task.Delay(200);
            }
            var id = Assert.Single(messageIds);
            var delivered = await mailpit.GetFromJsonAsync<JsonElement>($"/api/v1/message/{id}");
            Assert.Equal("Plan ready for your review", delivered.GetProperty("Subject").GetString());
            var body = delivered.GetProperty("Text").GetString()!;
            Assert.Contains($"http://localhost:3000/performance/cycles/{cycle.Id}/plans/{plan.Id}", body);
            Assert.DoesNotContain("assessment", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("rating", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("evidence", body, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            // Never delete the shared mailbox: remove only IDs selected by this unique recipient.
            if (messageIds.Count > 0)
            {
                using var request = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/messages")
                    { Content = JsonContent.Create(new { IDs = messageIds }) };
                using var cleanup = await mailpit.SendAsync(request);
                cleanup.EnsureSuccessStatusCode();
            }
        }
    }
}

[AttributeUsage(AttributeTargets.Method)]
internal sealed class MailpitFactAttribute : FactAttribute
{
    public MailpitFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("FUSION_PERFORMANCE_MAILPIT_TEST_URL")))
            Skip = "Set FUSION_PERFORMANCE_MAILPIT_TEST_URL to a local Mailpit API URL for SMTP acceptance.";
    }
}

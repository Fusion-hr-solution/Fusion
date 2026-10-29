using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests;

public sealed class NotificationTests
{
    public static PerformanceOutboxMessage Message(Guid tenant, Guid recipient, PerformanceNotificationKind kind = PerformanceNotificationKind.PlanSubmitted)
    {
        var plan = Guid.NewGuid();
        return PerformanceOutboxMessage.ForPlan(tenant, kind, recipient, plan, Guid.NewGuid(),
            new(Guid.NewGuid(), plan, "Emma Employee"));
    }

    /// <summary>The in-app row staged beside <paramref name="message"/>, which its email is worded from.</summary>
    public static PerformanceNotification InAppFor(PerformanceOutboxMessage message)
    {
        var payload = JsonSerializer.Deserialize<PlanNotificationPayload>(message.Payload)!;
        var plan = EmployeePlan.Create(message.TenantId, payload.CycleId, Guid.NewGuid(), Guid.NewGuid(), "Emma Employee", null,
            message.RecipientEmployeeId, "Manager");
        typeof(EmployeePlan).GetProperty(nameof(EmployeePlan.Id))!.SetValue(plan, payload.PlanId);
        return PerformanceNotification.For(message, null, PerformanceNotificationTemplates.ForPlan(plan, message.Kind, "Emma Employee"),
            DateTime.UtcNow);
    }

    [Fact]
    public async Task Enqueue_is_staged_with_the_transition_and_repeated_staging_is_deduplicated()
    {
        var store = TestStore.ForNewTenant();
        var employee = Guid.NewGuid(); var manager = Guid.NewGuid();
        var plan = EmployeePlan.Create(store.TenantId, Guid.NewGuid(), Guid.NewGuid(), employee, "Emma", null, manager, "Manager");
        plan.Submit(employee, new PlanSubmissionFacts(1, true, 100m, true, false, PlanAlignmentPolicy.AtLeastOneConnected));
        await using (var db = store.NewContext())
        {
            var notifications = new PerformanceNotifications(db);
            notifications.EnqueuePlan(plan, PerformanceNotificationKind.PlanSubmitted, plan.EmployeeDisplayName);
            notifications.EnqueuePlan(plan, PerformanceNotificationKind.PlanSubmitted, plan.EmployeeDisplayName);
            Assert.Single(db.OutboxMessages.Local);
            await using (var beforeCommit = store.NewContext()) Assert.Empty(await beforeCommit.OutboxMessages.ToListAsync());
            db.EmployeePlans.Add(plan);
            await db.SaveChangesAsync();
        }
        await using var verify = store.NewContext();
        var message = Assert.Single(await verify.OutboxMessages.ToListAsync());
        Assert.Equal(manager, message.RecipientEmployeeId);
        Assert.Equal(plan.Id, message.ResourceId);
        using var payload = JsonDocument.Parse(message.Payload);
        Assert.Equal(3, payload.RootElement.EnumerateObject().Count());
        Assert.Equal(plan.Id.ToString(), payload.RootElement.GetProperty("PlanId").GetString());
    }

    [Fact]
    public void Failed_delivery_backs_off_and_dead_letters_on_the_eighth_attempt()
    {
        var message = Message(Guid.NewGuid(), Guid.NewGuid());
        var now = DateTime.UtcNow;
        for (var attempt = 1; attempt <= 8; attempt++)
        {
            message.Fail(now, "SmtpException");
            Assert.Equal(attempt, message.Attempts);
            Assert.Equal("SmtpException", message.LastError);
            if (attempt < 8)
            {
                Assert.True(message.IsPending);
                Assert.Equal(now.AddSeconds(15 * Math.Pow(2, attempt - 1)), message.NextAttemptAt);
                Assert.Null(message.SkippedReason);
            }
        }
        Assert.False(message.IsPending);
        Assert.Equal("dead-letter", message.SkippedReason);
        Assert.Throws<InvalidOperationException>(() => message.MarkDispatched(now));
    }

    [Theory]
    [InlineData(false, true, "disabled")]
    [InlineData(true, false, "no-work-email")]
    [InlineData(true, true, null)]
    public async Task Dispatch_resolves_the_current_work_email_or_records_the_skip(bool enabled, bool hasEmail, string? skip)
    {
        var store = TestStore.ForNewTenant();
        var core = new FakeCoreWorkforceClient();
        var recipient = core.Add("Recipient");
        core.ById[recipient.EmployeeId] = recipient with { WorkEmail = hasEmail ? "current@performance.test" : null };
        var sender = new CapturingNotificationSender();
        var message = Message(store.TenantId, recipient.EmployeeId);
        await using (var db = store.NewContext())
        {
            db.OutboxMessages.Add(message); db.Notifications.Add(InAppFor(message)); await db.SaveChangesAsync();
        }
        await using (var db = store.NewContext())
        {
            var tracked = await db.OutboxMessages.SingleAsync();
            var dispatcher = new PerformanceNotificationDispatcher(db, store.Tenant, core, new FakeNotificationAudienceClient(), sender,
                Options.Create(new PerformanceNotificationOptions { Enabled = enabled, ShellBaseUrl = "http://localhost:3000" }));
            await dispatcher.DispatchAsync(tracked, DateTime.UtcNow, default);
            await dispatcher.DispatchAsync(tracked, DateTime.UtcNow, default);
        }
        await using var verify = store.NewContext();
        var result = await verify.OutboxMessages.SingleAsync();
        Assert.Equal(skip, result.SkippedReason);
        if (skip is null)
        {
            Assert.NotNull(result.DispatchedAt);
            Assert.Equal("current@performance.test", Assert.Single(sender.Delivered).Email);
        }
        else Assert.Empty(sender.Delivered);
        if (!enabled) Assert.Null(core.LastAsOf);
    }

    [Fact]
    public async Task Transport_failure_keeps_the_notification_pending_and_retry_delivers_once()
    {
        var store = TestStore.ForNewTenant();
        var core = new FakeCoreWorkforceClient();
        var recipient = core.Add("Recipient");
        var sender = new CapturingNotificationSender { Fail = true };
        await using var db = store.NewContext();
        var message = Message(store.TenantId, recipient.EmployeeId);
        db.OutboxMessages.Add(message); db.Notifications.Add(InAppFor(message)); await db.SaveChangesAsync();
        var dispatcher = new PerformanceNotificationDispatcher(db, store.Tenant, core, new FakeNotificationAudienceClient(), sender,
            Options.Create(new PerformanceNotificationOptions { Enabled = true, ShellBaseUrl = "http://localhost:3000" }));
        await dispatcher.DispatchAsync(message, DateTime.UtcNow, default);
        Assert.Equal(1, message.Attempts);
        Assert.True(message.IsPending);
        Assert.Null(message.DispatchedAt);
        Assert.Equal("InvalidOperationException", message.LastError);
        Assert.DoesNotContain("private", message.LastError);
        sender.Fail = false;
        await dispatcher.DispatchAsync(message, message.NextAttemptAt, default);
        await dispatcher.DispatchAsync(message, message.NextAttemptAt, default);
        Assert.Single(sender.Delivered);
        Assert.Equal(2, message.Attempts);
        Assert.NotNull(message.DispatchedAt);
        Assert.Null(message.LastError);
    }

    [Fact]
    public async Task Dispatch_refuses_another_tenant_before_resolving_or_sending()
    {
        var store = TestStore.ForNewTenant();
        var core = new FakeCoreWorkforceClient(); var sender = new CapturingNotificationSender();
        await using var db = store.NewContext();
        var dispatcher = new PerformanceNotificationDispatcher(db, store.Tenant, core, new FakeNotificationAudienceClient(), sender,
            Options.Create(new PerformanceNotificationOptions { Enabled = true, ShellBaseUrl = "http://localhost:3000" }));
        await Assert.ThrowsAsync<InvalidOperationException>(() => dispatcher.DispatchAsync(Message(Guid.NewGuid(), Guid.NewGuid()), DateTime.UtcNow, default));
        Assert.Null(core.LastAsOf); Assert.Empty(sender.Delivered);
    }

    [Theory]
    [InlineData(PerformanceNotificationKind.PlanSubmitted)]
    [InlineData(PerformanceNotificationKind.PlanReturned)]
    [InlineData(PerformanceNotificationKind.PlanApproved)]
    public void Emails_link_to_the_canonical_plan_through_the_shell_and_include_only_safe_content(PerformanceNotificationKind kind)
    {
        var message = Message(Guid.NewGuid(), Guid.NewGuid(), kind);
        var payload = JsonSerializer.Deserialize<PlanNotificationPayload>(message.Payload)!;
        var email = InAppFor(message).EnglishEmail();
        Assert.Contains($"http://localhost:3000/performance/cycles/{payload.CycleId}/plans/{payload.PlanId}", email.Text);
        Assert.DoesNotContain("rating", email.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("assessment", email.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("evidence", email.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("calibration", email.Text, StringComparison.OrdinalIgnoreCase);
    }
}

public sealed class CapturingNotificationSender : IPerformanceNotificationSender
{
    public bool Fail { get; set; }
    public List<(string Email, FusionOutgoingEmail Mail)> Delivered { get; } = [];
    public Task SendAsync(FusionOutgoingEmail email, CancellationToken cancellationToken)
    {
        if (Fail) throw new InvalidOperationException("private provider detail");
        Delivered.Add((email.To, email));
        return Task.CompletedTask;
    }
}

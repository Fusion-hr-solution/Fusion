using System.Security.Claims;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Notifications;
using EY.HRPlatform.CoreHR.Features.People.Changes;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Notifications;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.Features.Organization;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Notifications;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.CoreHR.Tests.Features.People;

/// <summary>
/// Team and job change notifications (B-155) staged by the real change handlers: who hears what, that they commit with
/// the change, show under Upcoming on their date, and never reach another tenant or another person.
/// </summary>
public sealed partial class TemporalWorkforceMaintenanceRelationalTests
{
    private const string UnsubscribeKey = "test-unsubscribe-key-of-at-least-32-characters";

    [RelationalDatabaseFact]
    public Task A_manager_change_tells_the_person_and_both_managers_and_shows_on_its_date()
        => WithDatabaseAsync(async (db, ctx, other) =>
        {
            var date = DateOnly.FromDateTime(Today).AddDays(10);
            var change = await JobAsync(db, ctx, ctx.KarimKey, new JobChangeRequest(At(date), ManagerEmployeeId: ctx.YoussefId));

            var rows = await db.Notifications.AsNoTracking().OrderBy(item => item.Kind).ToListAsync();
            Assert.Equal(
                [(ctx.KarimId, CoreNotificationKind.ManagerChanged), (ctx.YoussefId, CoreNotificationKind.TeamJoining), (ctx.AminaId, CoreNotificationKind.TeamLeaving)],
                rows.Select(item => (item.RecipientEmployeeId, item.Kind)).ToList());
            Assert.All(rows, item => Assert.Equal(change.Id, item.ChangeId));

            var feed = Feed(db, ctx.Tenant.TenantId);
            var karim = await feed.PageAsync(ctx.KarimId, null, null, "en", default);
            var item = Assert.Single(karim.Items);
            Assert.Equal(("core", "team", "/core/profile"), (item.Module, item.Badge, item.Href));
            Assert.Equal($"Your manager will be Youssef Ben Ali from {date.ToString("ddd d MMM", System.Globalization.CultureInfo.InvariantCulture)}", item.Title);
            Assert.Equal("Recorded by Workforce Administrator", item.Context);
            Assert.StartsWith("Youssef Ben Ali sera votre responsable", (await feed.PageAsync(ctx.KarimId, null, null, "fr", default)).Items[0].Title);
            Assert.Equal("Karim Zayed joins your team", (await feed.UpcomingAsync(ctx.YoussefId, 14, "en", default)).Single().Title);
            var upcoming = Assert.Single(await feed.UpcomingAsync(ctx.KarimId, 14, "en", default));
            Assert.Equal((date, "Youssef Ben Ali becomes your manager"), (upcoming.Date, upcoming.Title));
            Assert.Empty(await feed.UpcomingAsync(ctx.KarimId, 5, "en", default));

            // Another person can't read or clear Karim's; another tenant sees nothing.
            Assert.Equal(1, (await feed.MarkReadAsync(ctx.AminaId, [Guid.Parse(item.Id)], false, default)).UnreadCount);
            Assert.Equal(1, (await feed.PageAsync(ctx.KarimId, null, null, "en", default)).UnreadCount);
            Assert.Equal(0, await other.Db.Notifications.CountAsync());
            Assert.Empty((await Feed(other.Db, other.Tenant.TenantId).PageAsync(ctx.KarimId, null, null, "en", default)).Items);
            Assert.Empty(await Feed(other.Db, other.Tenant.TenantId).UpcomingAsync(ctx.KarimId, 14, "en", default));
            Assert.Equal(0, (await feed.MarkReadAsync(ctx.KarimId, [Guid.Parse(item.Id)], false, default)).UnreadCount);

            // A cancelled change drops out of Upcoming.
            Assert.True((await CancelAsync(db, ctx, change.Id)).IsSuccess);
            Assert.Empty(await feed.UpcomingAsync(ctx.KarimId, 14, "en", default));
        });

    [RelationalDatabaseFact]
    public Task An_end_of_employment_tells_the_reports_and_their_new_manager_but_never_the_person_who_recorded_it()
        => WithDatabaseAsync(async (db, ctx, _) =>
        {
            // Youssef records it, so Youssef hears nothing although Karim joins his team.
            var http = new HttpContextAccessor
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(CustomClaimTypes.EmployeeId, ctx.YoussefId.ToString())], "test")),
                },
            };
            var service = new WorkforceChangeService(db, ctx.Tenant, ctx.Mutation, ctx.Organization,
                new WorkEmailOccupancyService(db, ctx.Tenant), new CoreChangeNotifications(db, http));
            var lastDay = DateOnly.FromDateTime(Today).AddDays(3);
            var ended = await new EndEmploymentChangeCommandHandler(db, service, new WorkforceChangeReader(db)).Handle(
                new EndEmploymentChangeCommand(ctx.AminaKey, new EndEmploymentChangeRequest(At(lastDay),
                    [new ReportReassignmentRequest(ctx.KarimId, ctx.YoussefId)]), Actor), default);
            Assert.True(ended.IsSuccess, ended.IsFailure ? ended.Error.Message : null);

            var row = Assert.Single(await db.Notifications.AsNoTracking().ToListAsync());
            Assert.Equal((ctx.KarimId, CoreNotificationKind.ManagerChanged), (row.RecipientEmployeeId, row.Kind));
            Assert.Equal(ctx.YoussefId, row.ActorEmployeeId);
            Assert.Equal(lastDay.AddDays(1).ToString("yyyy-MM-dd"), row.Values["date"]);
        });

    [RelationalDatabaseFact]
    public Task Email_choice_is_the_callers_own_and_a_signed_link_turns_only_that_group_off()
        => WithDatabaseAsync(async (db, ctx, other) =>
        {
            var feed = Feed(db, ctx.Tenant.TenantId);
            var initial = await feed.PreferencesAsync(ctx.KarimId, leadsPeople: false, default);
            var group = Assert.Single(initial.Groups);
            Assert.Equal((CoreNotificationPreference.TeamAndJobChanges, true, 0u, 2), (group.Key, group.Email, initial.Version, group.Items.Count));
            Assert.Equal(3, (await feed.PreferencesAsync(ctx.AminaId, leadsPeople: true, default)).Groups[0].Items.Count);

            var off = await feed.UpdatePreferencesAsync(ctx.KarimId, false,
                new UpdateNotificationPreferencesRequest(0, [CoreNotificationPreference.TeamAndJobChanges]), default);
            Assert.Equal(PreferencesRefusal.None, off.Refusal);
            Assert.False(off.Value!.Groups[0].Email);
            Assert.Equal(PreferencesRefusal.Changed, (await feed.UpdatePreferencesAsync(ctx.KarimId, false,
                new UpdateNotificationPreferencesRequest(0, []), default)).Refusal);
            Assert.Equal(PreferencesRefusal.Invalid, (await feed.UpdatePreferencesAsync(ctx.AminaId, false,
                new UpdateNotificationPreferencesRequest(0, ["deadline-reminders"]), default)).Refusal);
            Assert.True((await feed.PreferencesAsync(ctx.AminaId, false, default)).Groups[0].Email);

            // The link carries its own tenant; a forged or foreign one changes nothing.
            var token = UnsubscribeToken.Issue(new UnsubscribeClaim(ctx.Tenant.TenantId, ctx.AminaId, CoreNotificationPreference.TeamAndJobChanges), UnsubscribeKey);
            Assert.False(await Feed(other.Db, other.Tenant.TenantId).UnsubscribeAsync(token, default));
            Assert.False(await Feed(db, null).UnsubscribeAsync(token + "x", default));
            Assert.False(await Feed(db, null).UnsubscribeAsync(UnsubscribeToken.Issue(
                new UnsubscribeClaim(ctx.Tenant.TenantId, ctx.AminaId, "plans-and-goals"), UnsubscribeKey), default));
            Assert.True(await Feed(db, null).UnsubscribeAsync(token, default));
            Assert.False((await feed.PreferencesAsync(ctx.AminaId, false, default)).Groups[0].Email);

            // A person who turned email off keeps the bell; the email is skipped.
            await JobAsync(db, ctx, ctx.KarimKey, new JobChangeRequest(At(DateOnly.FromDateTime(Today).AddDays(2)), JobTitle: "Principal Consultant"));
            var notification = await db.Notifications.SingleAsync(item => item.RecipientEmployeeId == ctx.KarimId);
            var tenant = new TenantContext();
            tenant.SetTenant(ctx.Tenant.TenantId);
            var sender = new CapturingSender();
            await new CoreNotificationDispatcher(db, tenant, new FixedAudience(), sender, Options()).DispatchAsync(notification, DateTime.UtcNow, default);
            Assert.Equal(CoreNotificationDispatcher.RecipientOptedOut, notification.EmailSkippedReason);
            Assert.Empty(sender.Sent);
        });

    private static CoreNotificationFeed Feed(CoreHRDbContext db, Guid? tenantId)
    {
        var tenant = new TenantContext();
        if (tenantId is { } id) tenant.SetTenant(id);
        return new CoreNotificationFeed(db, tenant, Options());
    }

    private static IOptions<CoreNotificationOptions> Options() => Microsoft.Extensions.Options.Options.Create(new CoreNotificationOptions
    {
        Enabled = true, ShellBaseUrl = "http://localhost:3000", UnsubscribeKey = UnsubscribeKey,
    });

    private sealed class CapturingSender : ICoreNotificationSender
    {
        public List<FusionOutgoingEmail> Sent { get; } = [];
        public Task SendAsync(FusionOutgoingEmail email, CancellationToken cancellationToken)
        {
            Sent.Add(email);
            return Task.CompletedTask;
        }
    }

    private sealed class FixedAudience : ICoreNotificationAudienceClient
    {
        public Task<NotificationAudience> ReadAsync(IReadOnlyList<Guid> employeeIds, CancellationToken cancellationToken)
            => Task.FromResult(new NotificationAudience("Asteria", "Africa/Tunis", "fr", []));
    }
}

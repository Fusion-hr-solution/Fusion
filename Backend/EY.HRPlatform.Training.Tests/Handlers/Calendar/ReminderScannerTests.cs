using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Calendar.Reminders;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class ReminderScannerTests
{
    private static readonly DateTime Now = new(2026, 7, 10, 12, 0, 0, DateTimeKind.Utc);

    private sealed class FakeReminderEmailSender : IReminderEmailSender
    {
        public List<ReminderEmailMessage> Sent { get; } = new();

        public Task SendAsync(ReminderEmailMessage message, CancellationToken cancellationToken)
        {
            Sent.Add(message);
            return Task.CompletedTask;
        }
    }

    private static ReminderScanner Scanner(TrainingDbContext ctx, FakeReminderEmailSender fake)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Calendar:DisplayTimeZone"] = "UTC" })
            .Build();
        return new ReminderScanner(ctx, fake, config, NullLogger<ReminderScanner>.Instance);
    }

    private static async Task<Guid> SeedSession(
        TrainingDbContext ctx, DateTime startUtc, bool cancelled,
        params (Guid emp, string? email, EnrollmentStatus status)[] enrollments)
    {
        var cat = new TrainingCategory("Tech", "t");
        ctx.Categories.Add(cat);
        var course = new TrainingCourse("C#", null, 10, false, BadgeLevel.Bronze, cat.Id, trainingType: TrainingType.OnSite);
        ctx.Trainings.Add(course);
        var part = new TrainingPart(course.Id, "Day 1", null, 0, 7m);
        ctx.TrainingParts.Add(part);
        var session = new TrainingSession(part.Id, startUtc, startUtc.AddHours(2), "A101", 20, null, null, null, null);
        if (cancelled) session.Cancel("x");
        ctx.TrainingSessions.Add(session);
        foreach (var (emp, email, status) in enrollments)
            ctx.SessionEnrollments.Add(new SessionEnrollment(session.Id, emp, status, 0, "Name", email));
        await ctx.SaveChangesAsync();
        return session.Id;
    }

    [Fact]
    public async Task OneHourBracket_SendsReminder_AndRecordsDelivery()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeReminderEmailSender();
        await SeedSession(ctx, Now.AddMinutes(30), false, (Guid.NewGuid(), "a@x.com", EnrollmentStatus.Enrolled));

        await Scanner(ctx, fake).ScanAsync(Now, CancellationToken.None);

        var msg = Assert.Single(fake.Sent);
        Assert.Equal("a@x.com", msg.ToEmail);
        Assert.Contains("Reminder:", msg.Subject);
        Assert.Equal(60, (await ctx.ReminderDeliveries.SingleAsync()).OffsetMinutes);
    }

    [Fact]
    public async Task Dedupe_DoesNotResend_OnSecondScan()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeReminderEmailSender();
        await SeedSession(ctx, Now.AddMinutes(30), false, (Guid.NewGuid(), "a@x.com", EnrollmentStatus.Enrolled));

        await Scanner(ctx, fake).ScanAsync(Now, CancellationToken.None);
        await Scanner(ctx, fake).ScanAsync(Now, CancellationToken.None);

        Assert.Single(fake.Sent);
    }

    [Fact]
    public async Task TwentyFourHourBracket_FiresWhenHoursOut()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeReminderEmailSender();
        await SeedSession(ctx, Now.AddHours(5), false, (Guid.NewGuid(), "a@x.com", EnrollmentStatus.Enrolled));

        await Scanner(ctx, fake).ScanAsync(Now, CancellationToken.None);

        Assert.Single(fake.Sent);
        Assert.Equal(1440, (await ctx.ReminderDeliveries.SingleAsync()).OffsetMinutes);
    }

    [Fact]
    public async Task NeverAfterStart()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeReminderEmailSender();
        await SeedSession(ctx, Now.AddMinutes(-10), false, (Guid.NewGuid(), "a@x.com", EnrollmentStatus.Enrolled));

        await Scanner(ctx, fake).ScanAsync(Now, CancellationToken.None);

        Assert.Empty(fake.Sent);
    }

    [Fact]
    public async Task BeyondHorizon_NoReminder()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeReminderEmailSender();
        await SeedSession(ctx, Now.AddDays(2), false, (Guid.NewGuid(), "a@x.com", EnrollmentStatus.Enrolled));

        await Scanner(ctx, fake).ScanAsync(Now, CancellationToken.None);

        Assert.Empty(fake.Sent);
    }

    [Fact]
    public async Task Cancelled_Waitlisted_NoEmail_AllExcluded()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeReminderEmailSender();

        await SeedSession(ctx, Now.AddMinutes(30), cancelled: true, (Guid.NewGuid(), "c@x", EnrollmentStatus.Enrolled));
        await SeedSession(ctx, Now.AddMinutes(30), false,
            (Guid.NewGuid(), "w@x", EnrollmentStatus.Waitlisted),
            (Guid.NewGuid(), null, EnrollmentStatus.Enrolled));

        await Scanner(ctx, fake).ScanAsync(Now, CancellationToken.None);

        Assert.Empty(fake.Sent);
    }

    [Fact]
    public async Task DisabledPolicy_NoReminders()
    {
        await using var ctx = TestDbContextFactory.Create();
        var fake = new FakeReminderEmailSender();
        ctx.ReminderPolicies.Add(new ReminderPolicy(false, "1440,60"));
        await ctx.SaveChangesAsync();
        await SeedSession(ctx, Now.AddMinutes(30), false, (Guid.NewGuid(), "a@x", EnrollmentStatus.Enrolled));

        await Scanner(ctx, fake).ScanAsync(Now, CancellationToken.None);

        Assert.Empty(fake.Sent);
    }
}

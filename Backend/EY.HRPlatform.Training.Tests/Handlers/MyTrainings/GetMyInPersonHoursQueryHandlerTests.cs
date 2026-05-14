using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.MyTrainings.Queries;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.MyTrainings;

public class GetMyInPersonHoursQueryHandlerTests
{
    private static async Task<(TrainingDbContext ctx, Guid employeeId, Guid otherEmployeeId, Guid trainingId, Guid partId)>
        SeedAsync()
    {
        var ctx = await TestDbContextFactory.CreateWithSeedDataAsync();
        var training = ctx.Trainings.First();

        var part = new TrainingPart(training.Id, "Part A", null, 1, 3m);
        ctx.Set<TrainingPart>().Add(part);
        await ctx.SaveChangesAsync();

        return (ctx, Guid.NewGuid(), Guid.NewGuid(), training.Id, part.Id);
    }

    private static TrainingSession AddSession(
        TrainingDbContext ctx, Guid partId, DateTime startUtc, double durationHours)
    {
        var s = new TrainingSession(partId, startUtc, startUtc.AddHours(durationHours),
            "Room A", 25, null, null, "Trainer", null);
        ctx.TrainingSessions.Add(s);
        return s;
    }

    private static SessionEnrollment Attended(Guid sessionId, Guid employeeId)
    {
        var e = new SessionEnrollment(sessionId, employeeId, EnrollmentStatus.Enrolled);
        e.MarkAttended();
        return e;
    }

    [Fact]
    public async Task Handle_ReturnsZeroTotals_WhenNoEnrollments()
    {
        var (ctx, employeeId, _, _, _) = await SeedAsync();
        var handler = new GetMyInPersonHoursQueryHandler(ctx);

        var result = await handler.Handle(new GetMyInPersonHoursQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Value!.TotalHoursAllTime);
        Assert.Equal(0, result.Value.TotalHoursYear);
        Assert.Equal(0, result.Value.TotalHoursMonth);
        Assert.Empty(result.Value.AttendedSessions);
    }

    [Fact]
    public async Task Handle_SumsAttendedHours_AcrossSessions()
    {
        var (ctx, employeeId, _, _, partId) = await SeedAsync();
        var now = DateTime.UtcNow;
        var s1 = AddSession(ctx, partId, now.AddDays(-2), 3);
        var s2 = AddSession(ctx, partId, now.AddDays(-1), 2);
        await ctx.SaveChangesAsync();

        ctx.SessionEnrollments.Add(Attended(s1.Id, employeeId));
        ctx.SessionEnrollments.Add(Attended(s2.Id, employeeId));
        await ctx.SaveChangesAsync();

        var result = await new GetMyInPersonHoursQueryHandler(ctx)
            .Handle(new GetMyInPersonHoursQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(5, result.Value!.TotalHoursAllTime);
        Assert.Equal(5, result.Value.InPersonHours);
        Assert.Equal(2, result.Value.AttendedSessions.Count);
        // Most recent session first
        Assert.True(result.Value.AttendedSessions[0].StartUtc > result.Value.AttendedSessions[1].StartUtc);
    }

    [Fact]
    public async Task Handle_ExcludesNonAttendedEnrollments()
    {
        var (ctx, employeeId, _, _, partId) = await SeedAsync();
        var s = AddSession(ctx, partId, DateTime.UtcNow.AddDays(-1), 4);
        await ctx.SaveChangesAsync();

        // Enrolled but not attended
        ctx.SessionEnrollments.Add(new SessionEnrollment(s.Id, employeeId, EnrollmentStatus.Enrolled));
        await ctx.SaveChangesAsync();

        var result = await new GetMyInPersonHoursQueryHandler(ctx)
            .Handle(new GetMyInPersonHoursQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Value!.TotalHoursAllTime);
        Assert.Empty(result.Value.AttendedSessions);
    }

    [Fact]
    public async Task Handle_OnlyReturnsHoursForRequestedEmployee()
    {
        var (ctx, employeeId, otherEmployeeId, _, partId) = await SeedAsync();
        var s = AddSession(ctx, partId, DateTime.UtcNow.AddDays(-1), 3);
        await ctx.SaveChangesAsync();

        ctx.SessionEnrollments.Add(Attended(s.Id, otherEmployeeId));
        await ctx.SaveChangesAsync();

        var result = await new GetMyInPersonHoursQueryHandler(ctx)
            .Handle(new GetMyInPersonHoursQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, result.Value!.TotalHoursAllTime);
    }

    [Fact]
    public async Task Handle_WindowedTotals_FilterByDate()
    {
        var (ctx, employeeId, _, _, partId) = await SeedAsync();
        var now = DateTime.UtcNow;

        // Last year (only counts in AllTime)
        var sOld = AddSession(ctx, partId, new DateTime(now.Year - 1, 6, 1, 9, 0, 0, DateTimeKind.Utc), 4);
        // This year, before this month
        var thisYearOldMonth = new DateTime(now.Year, 1, 5, 9, 0, 0, DateTimeKind.Utc);
        var sYear = AddSession(ctx, partId, thisYearOldMonth, 3);
        // This month
        var sMonth = AddSession(ctx, partId, new DateTime(now.Year, now.Month, 1, 9, 0, 0, DateTimeKind.Utc), 2);
        await ctx.SaveChangesAsync();

        ctx.SessionEnrollments.AddRange(
            Attended(sOld.Id, employeeId),
            Attended(sYear.Id, employeeId),
            Attended(sMonth.Id, employeeId));
        await ctx.SaveChangesAsync();

        var result = await new GetMyInPersonHoursQueryHandler(ctx)
            .Handle(new GetMyInPersonHoursQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(9, result.Value!.TotalHoursAllTime);
        // Only non-old-year sessions count
        Assert.Equal(5, result.Value.TotalHoursYear);
        Assert.True(result.Value.TotalHoursMonth >= 2);
    }
}

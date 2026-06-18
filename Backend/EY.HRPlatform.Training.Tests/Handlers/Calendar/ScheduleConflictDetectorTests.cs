using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Features.Calendar.Conflicts;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Tests.TestHelpers;

namespace EY.HRPlatform.Training.Tests.Handlers.Calendar;

public class ScheduleConflictDetectorTests
{
    private static readonly DateTime Ten = new(2026, 7, 10, 10, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Twelve = new(2026, 7, 10, 12, 0, 0, DateTimeKind.Utc);

    private static Guid SeedPart(TrainingDbContext ctx)
    {
        var category = new TrainingCategory("Tech", "Technical");
        ctx.Categories.Add(category);
        var course = new TrainingCourse("C# Basics", null, 10, false, BadgeLevel.Bronze, category.Id, trainingType: TrainingType.OnSite);
        ctx.Trainings.Add(course);
        var part = new TrainingPart(course.Id, "Day 1", null, 0, 7m);
        ctx.TrainingParts.Add(part);
        return part.Id;
    }

    private static TrainingSession AddSession(TrainingDbContext ctx, Guid partId, DateTime start, DateTime end,
        string room = "A101", Guid? trainerEmployeeId = null, string? trainerEmail = null)
    {
        var s = new TrainingSession(partId, start, end, room, 20, null, trainerEmployeeId, null, trainerEmail);
        ctx.TrainingSessions.Add(s);
        return s;
    }

    [Fact]
    public async Task DetectsRoomOverlap_SameRoom_CaseInsensitive()
    {
        await using var ctx = TestDbContextFactory.Create();
        var partId = SeedPart(ctx);
        var existing = AddSession(ctx, partId, Ten, Twelve, "A101");
        await ctx.SaveChangesAsync();

        // probe 11:00–13:00 in "a101" (case-insensitive) overlaps 10:00–12:00
        var result = await ScheduleConflictDetector.DetectAsync(ctx, "a101", null, null,
            Ten.AddHours(1), Twelve.AddHours(1), null, CancellationToken.None);

        Assert.True(result.HasConflicts);
        Assert.Equal(existing.Id, Assert.Single(result.RoomConflicts).SessionId);
        Assert.Empty(result.TrainerConflicts);
    }

    [Fact]
    public async Task NoRoomConflict_WhenAdjacent_HalfOpenBounds()
    {
        await using var ctx = TestDbContextFactory.Create();
        var partId = SeedPart(ctx);
        AddSession(ctx, partId, Ten, Twelve, "A101");
        await ctx.SaveChangesAsync();

        // probe starts exactly when existing ends → no overlap under [Start, End)
        var result = await ScheduleConflictDetector.DetectAsync(ctx, "A101", null, null,
            Twelve, Twelve.AddHours(2), null, CancellationToken.None);

        Assert.Empty(result.RoomConflicts);
    }

    [Fact]
    public async Task ExcludesCancelledSessionsAndSelf()
    {
        await using var ctx = TestDbContextFactory.Create();
        var partId = SeedPart(ctx);
        var cancelled = AddSession(ctx, partId, Ten, Twelve, "A101");
        var self = AddSession(ctx, partId, Ten, Twelve, "A101");
        await ctx.SaveChangesAsync();
        cancelled.Cancel("x");
        await ctx.SaveChangesAsync();

        var result = await ScheduleConflictDetector.DetectAsync(ctx, "A101", null, null,
            Ten, Twelve, self.Id, CancellationToken.None);

        Assert.Empty(result.RoomConflicts); // cancelled excluded, self excluded
    }

    [Fact]
    public async Task DetectsTrainerOverlap_ByEmployeeId()
    {
        await using var ctx = TestDbContextFactory.Create();
        var partId = SeedPart(ctx);
        var trainer = Guid.NewGuid();
        var existing = AddSession(ctx, partId, Ten, Twelve, "A101", trainerEmployeeId: trainer);
        await ctx.SaveChangesAsync();

        // different room, same trainer, overlapping → trainer conflict only
        var result = await ScheduleConflictDetector.DetectAsync(ctx, "B202", trainer, null,
            Ten, Twelve, null, CancellationToken.None);

        Assert.True(result.TrainerCheckable);
        Assert.Empty(result.RoomConflicts);
        Assert.Equal(existing.Id, Assert.Single(result.TrainerConflicts).SessionId);
    }

    [Fact]
    public async Task DetectsTrainerOverlap_ByExactEmail_CaseInsensitive()
    {
        await using var ctx = TestDbContextFactory.Create();
        var partId = SeedPart(ctx);
        var existing = AddSession(ctx, partId, Ten, Twelve, "A101", trainerEmail: "ext@vendor.com");
        await ctx.SaveChangesAsync();

        var result = await ScheduleConflictDetector.DetectAsync(ctx, null, null, "EXT@Vendor.com",
            Ten, Twelve, null, CancellationToken.None);

        Assert.True(result.TrainerCheckable);
        Assert.Equal(existing.Id, Assert.Single(result.TrainerConflicts).SessionId);
    }

    [Fact]
    public async Task TrainerNotCheckable_WhenNoIdAndNoEmail()
    {
        await using var ctx = TestDbContextFactory.Create();
        var partId = SeedPart(ctx);
        AddSession(ctx, partId, Ten, Twelve, "A101", trainerEmail: "ext@vendor.com");
        await ctx.SaveChangesAsync();

        // external trainer known only by free-text name → unverifiable
        var result = await ScheduleConflictDetector.DetectAsync(ctx, null, null, null,
            Ten, Twelve, null, CancellationToken.None);

        Assert.False(result.TrainerCheckable);
        Assert.Empty(result.TrainerConflicts);
        Assert.False(result.HasConflicts);
    }
}

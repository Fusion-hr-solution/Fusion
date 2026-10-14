using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

public sealed class RatingScaleTests
{
    [Fact]
    public async Task First_read_creates_five_level_default_and_review_defaults()
    {
        var store = TestStore.ForNewTenant();
        await using (var db = store.NewContext())
        {
            var scale = await new GetRatingScaleHandler(db, store.Tenant).Handle(new(), default);
            Assert.Equal(1, scale.Value.ScaleVersion);
            Assert.Equal(new[] { "Needs improvement", "Developing", "Effective", "Strong", "Exceptional" },
                scale.Value.Levels.Select(level => level.Label));
        }
        await using (var db = store.NewContext())
        {
            var settings = await new GetCycleSettingsHandler(db, store.Tenant).Handle(new(), default);
            Assert.True(settings.Value.DefaultSelfAssessmentEnabled);
            Assert.True(settings.Value.DefaultObjectiveRatingsEnabled);
            Assert.False(settings.Value.DefaultCalibrationEnabled);
        }
    }

    [Theory]
    [InlineData(2)]
    [InlineData(8)]
    public async Task Scale_level_count_must_be_between_three_and_seven(int count)
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var result = await new UpdateRatingScaleHandler(db, store.Tenant, new TestPerformanceAudit(db))
            .Handle(new(new UpdateRatingScaleRequest(Enumerable.Range(1, count).Select(i => new RatingScaleLevelDto(i, $"Level {i}", null)).ToArray()) { ExpectedVersion = 0 }), default);
        Assert.Equal(PerformanceErrors.Codes.RatingScaleInvalid, result.Error.Code);
        Assert.Empty(await db.RatingScales.ToListAsync());
    }

    [Fact]
    public async Task Labels_must_be_unique_case_insensitively()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var result = await new UpdateRatingScaleHandler(db, store.Tenant, new TestPerformanceAudit(db))
            .Handle(new(new UpdateRatingScaleRequest(new[] { new RatingScaleLevelDto(1, "Effective", null), new(2, "effective", null), new(3, "Strong", null) }) { ExpectedVersion = 0 }), default);
        Assert.Equal(PerformanceErrors.Codes.RatingScaleInvalid, result.Error.Code);
        Assert.Empty(await db.RatingScaleVersions.ToListAsync());
    }

    [Fact]
    public async Task Each_save_appends_a_version_and_audits_the_change()
    {
        var store = TestStore.ForNewTenant();
        Guid firstVersionId;
        await using (var db = store.NewContext())
        {
            var get = await new GetRatingScaleHandler(db, store.Tenant).Handle(new(), default);
            firstVersionId = (await db.RatingScaleVersions.SingleAsync()).Id;
            var levels = new[] { new RatingScaleLevelDto(1, "Below", null), new(2, "Meeting", null), new(3, "Exceeds", "Consistently exceeds") };
            var saved = await new UpdateRatingScaleHandler(db, store.Tenant, new TestPerformanceAudit(db))
                .Handle(new(new UpdateRatingScaleRequest(levels) { ExpectedVersion = get.Value.Version }), default);
            Assert.True(saved.IsSuccess);
            Assert.Equal(2, saved.Value.ScaleVersion);
            Assert.Equal("Below", saved.Value.Levels[0].Label);
            Assert.Equal(2, await db.RatingScaleVersions.CountAsync());
            Assert.True(await db.AuditEntries.AnyAsync(e => e.ResourceType == "RatingScale" && e.Action == PerformanceAuditActions.RatingScaleChanged));
        }
        await using (var db = store.NewContext())
        {
            var old = await db.RatingScaleVersions.SingleAsync(v => v.Id == firstVersionId);
            Assert.Equal("Needs improvement", old.Levels[0].Label);
        }
    }

    [Fact]
    public async Task Version_rows_reject_updates_and_deletes()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        await new GetRatingScaleHandler(db, store.Tenant).Handle(new(), default);
        var version = await db.RatingScaleVersions.SingleAsync();
        db.Entry(version).Property(nameof(version.LevelsJson)).CurrentValue = "[]";
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
        db.Entry(version).State = EntityState.Deleted;
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }
}

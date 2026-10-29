using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Calibration;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;
using static EY.HRPlatform.Performance.Tests.TestHelpers.CalibrationWorld;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Slice 5: nine-box bands, potential calibrated beside the rating, conflicts and the finalized outcome.</summary>
public sealed class CalibrationPotentialTests
{
    private static readonly Person[] Team =
    [
        new("Karim Haddad", "Omar Mansour"),
        new("Hamza Dridi", "Omar Mansour"),
        new("Tarek Ayari", "Mariam Gharbi"),
    ];

    [Theory]
    [InlineData(3, 1, 2)]
    [InlineData(4, 1, 2)]
    [InlineData(5, 2, 3)]
    [InlineData(6, 2, 4)]
    [InlineData(7, 2, 4)]
    public void Default_bands_split_every_scale_into_three_non_empty_bands(int levels, int lowTop, int midTop)
    {
        var bands = NineBoxBands.Default(Enumerable.Range(1, levels).ToArray());
        Assert.Equal(new NineBoxBands(lowTop, midTop), bands);
        Assert.Equal(0, bands.BandOf(1));
        Assert.Equal(2, bands.BandOf(levels));
    }

    [Theory]
    [InlineData(2, 2)]
    [InlineData(3, 2)]
    [InlineData(1, 5)]
    [InlineData(0, 3)]
    public void Bands_that_leave_a_band_empty_are_rejected(int lowTop, int midTop)
        => Assert.Throws<ArgumentException>(() => NineBoxBands.Validate(lowTop, midTop, [1, 2, 3, 4, 5]));

    [Fact]
    public async Task Settings_hold_the_bands_admin_only_and_reject_an_empty_band()
    {
        await using var factory = new PerformanceApiFactory();
        using var admin = factory.CreateAuthenticatedClient(permissions:
            [new(PerformancePermissions.CycleManage, PermissionScopes.Tenant), new(PerformancePermissions.CycleView, PermissionScopes.Tenant),
             new(PerformancePermissions.SettingsManage, PermissionScopes.Tenant)]);
        var settings = await ReviewQuestionLibraryTests.ReadDataAsync(await admin.GetAsync("/api/performance/settings"));
        var bands = settings.GetProperty("nineBoxBands");
        Assert.Equal((2, 3, false), (bands.GetProperty("lowTop").GetInt32(), bands.GetProperty("midTop").GetInt32(), bands.GetProperty("custom").GetBoolean()));

        using (var empty = await admin.PutAsJsonAsync("/api/performance/settings", Body(settings, new { lowTop = 3, midTop = 3 })))
            Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        var changed = await ReviewQuestionLibraryTests.ReadDataAsync(
            await admin.PutAsJsonAsync("/api/performance/settings", Body(settings, new { lowTop = 1, midTop = 3 })));
        Assert.Equal((1, 3, true), (changed.GetProperty("nineBoxBands").GetProperty("lowTop").GetInt32(),
            changed.GetProperty("nineBoxBands").GetProperty("midTop").GetInt32(), changed.GetProperty("nineBoxBands").GetProperty("custom").GetBoolean()));
        var reset = await ReviewQuestionLibraryTests.ReadDataAsync(
            await admin.PutAsJsonAsync("/api/performance/settings", Body(changed, new { lowTop = (int?)null, midTop = (int?)null })));
        Assert.False(reset.GetProperty("nineBoxBands").GetProperty("custom").GetBoolean());
        await using (var db = factory.Store.NewContext())
            Assert.Contains(await db.AuditEntries.Where(entry => entry.Action == PerformanceAuditActions.SettingsChanged).Select(entry => entry.Summary).ToListAsync(),
                payload => payload.Contains("NineBoxLowTop"));

        using var viewer = factory.CreateAuthenticatedClient(permissions: [new(PerformancePermissions.CycleView, PermissionScopes.Tenant)]);
        using var denied = await viewer.PutAsJsonAsync("/api/performance/settings", Body(reset, new { lowTop = 1, midTop = 3 }));
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
    }

    [Fact]
    public async Task The_session_copies_the_bands_when_it_opens_and_keeps_them()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var settings = CycleSettings.CreateDefault(store.TenantId);
        settings.UpdateNineBoxBands(1, 3, [1, 2, 3, 4, 5]);
        db.CycleSettings.Add(settings);
        var world = await SeedAsync(db, store, Team);
        Assert.True((await OpenAsync(db, world)).IsSuccess);

        settings.UpdateNineBoxBands(2, 4, [1, 2, 3, 4, 5]);
        await db.SaveChangesAsync();
        var session = await db.CalibrationSessions.AsNoTracking().SingleAsync();
        Assert.Equal(new NineBoxBands(1, 3), session.Bands);
    }

    [Fact]
    public async Task Potential_is_calibrated_with_a_reason_and_the_manager_potential_never_changes()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await SeedAsync(db, store, Team);
        var hamza = world.Of("Hamza Dridi");
        await SubmitManagerAsync(db, hamza, 3, ReviewPotential.Developing);
        await OpenAsync(db, world);

        var unexplained = await AdjustAsync(db, world, hamza, 3, null, ReviewPotential.Growing);
        Assert.Equal(PerformanceErrors.Codes.CalibrationInvalid, unexplained.Error.Code);
        Assert.Contains("potential", unexplained.Error.Message);

        var raised = await AdjustAsync(db, world, hamza, 4, "Led the client migration alone.", ReviewPotential.Growing);
        Assert.True(raised.IsSuccess, raised.IsSuccess ? null : raised.Error.Message);
        Assert.Equal((ReviewPotential.Developing, ReviewPotential.Growing, true),
            (raised.Value.OriginalPotential, raised.Value.CurrentPotential, raised.Value.PotentialAdjusted));
        var entry = Assert.Single(raised.Value.History);
        Assert.Equal((3, 4, ReviewPotential.Developing, ReviewPotential.Growing), (entry.PreviousRating, entry.NewRating, entry.PreviousPotential, entry.NewPotential));
        Assert.Equal(ReviewPotential.Developing, (await db.PerformanceReviews.AsNoTracking().SingleAsync(review => review.Id == hamza.Id)).Potential);
        var audit = await db.AuditEntries.Where(item => item.Action == PerformanceAuditActions.CalibrationSubjectChanged).SingleAsync();
        Assert.Contains("Growing", audit.Summary);
        Assert.Contains("Led the client migration alone.", audit.Summary);

        // Omitting potential keeps it; restoring both clears the reason.
        var keep = await AdjustAsync(db, world, hamza, 4, "Led the client migration alone.", discussion: CalibrationDiscussionState.Discussed);
        Assert.Equal(ReviewPotential.Growing, keep.Value.CurrentPotential);
        var restored = await AdjustAsync(db, world, hamza, 3, null, ReviewPotential.Developing);
        Assert.True(restored.IsSuccess);
        Assert.Equal((false, false, (string?)null), (restored.Value.Adjusted, restored.Value.PotentialAdjusted, restored.Value.Rationale));
        Assert.Equal(2, restored.Value.History.Count);
    }

    [Fact]
    public async Task Potential_in_a_round_without_potential_is_rejected()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await SeedAsync(db, store, Team, potential: false);
        var tarek = world.Of("Tarek Ayari");
        await SubmitManagerAsync(db, tarek, 4, potential: null);
        await OpenAsync(db, world);
        var rejected = await AdjustAsync(db, world, tarek, 4, "Reason", ReviewPotential.High);
        Assert.Equal(PerformanceErrors.Codes.CalibrationPotentialDisabled, rejected.Error.Code);
    }

    [Fact]
    public async Task A_stale_change_is_refused_with_the_other_facilitators_values()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await SeedAsync(db, store, Team);
        var karim = world.Of("Karim Haddad");
        await SubmitManagerAsync(db, karim, 5, ReviewPotential.High);
        await OpenAsync(db, world);
        var opened = await db.CalibrationSubjects.AsNoTracking().Where(subject => subject.ReviewId == karim.Id).Select(subject => subject.Version).SingleAsync();
        Assert.True((await AdjustAsync(db, world, karim, 4, "Objectives at 64%.")).IsSuccess);

        var khaled = new FacilitatorIdentity(Guid.NewGuid(), Guid.NewGuid(), "Khaled Sassi");
        var session = await db.CalibrationSessions.SingleAsync();
        session.ReplaceFacilitators([Hr, khaled], Hr.UserId, DateTime.UtcNow);
        await db.SaveChangesAsync();
        // The in-memory store keeps row versions still; the relational suite covers a real concurrent write.
        var stale = await AdjustAsync(db, world, karim, 3, "Below the bar.", actor: khaled, version: opened + 1);
        Assert.Equal(PerformanceErrors.Codes.CalibrationConflict, stale.Error.Code);
        var details = PerformanceErrors.Details(stale.Error);
        Assert.Equal(FailureKind.Stale, details.Kind);
        var conflict = Assert.IsType<CalibrationConflictDto>(details.Extra);
        Assert.Equal((4, "Amira Khelifi"), (conflict.Current.CurrentRating, conflict.ChangedBy));
    }

    [Fact]
    public async Task Finalizing_sets_the_final_potential_and_flags_only_rating_changes()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await SeedAsync(db, store, Team);
        await SubmitManagerAsync(db, world.Of("Karim Haddad"), 5, ReviewPotential.High);
        await SubmitManagerAsync(db, world.Of("Hamza Dridi"), 3, ReviewPotential.Developing);
        await SubmitManagerAsync(db, world.Of("Tarek Ayari"), 4, ReviewPotential.Growing);
        await OpenAsync(db, world);
        await AdjustAsync(db, world, world.Of("Tarek Ayari"), 3, "Went beyond the role once.");
        await AdjustAsync(db, world, world.Of("Hamza Dridi"), 3, "Ready for more.", ReviewPotential.Growing);

        Assert.True((await FinalizeAsync(db, world)).IsSuccess);
        var reviews = await db.PerformanceReviews.AsNoTracking().ToDictionaryAsync(review => review.SubjectDisplayName);
        Assert.Equal((3, ReviewPotential.Growing, true), (reviews["Tarek Ayari"].FinalRating, reviews["Tarek Ayari"].FinalPotential, reviews["Tarek Ayari"].CalibrationChangedRating));
        Assert.Equal((3, ReviewPotential.Growing, false), (reviews["Hamza Dridi"].FinalRating, reviews["Hamza Dridi"].FinalPotential, reviews["Hamza Dridi"].CalibrationChangedRating));
        Assert.Equal(ReviewPotential.Developing, reviews["Hamza Dridi"].Potential);
        Assert.Equal((5, ReviewPotential.High, false), (reviews["Karim Haddad"].FinalRating, reviews["Karim Haddad"].FinalPotential, reviews["Karim Haddad"].CalibrationChangedRating));

        // Each reviewer hears once, with counts only.
        var told = await db.Notifications.AsNoTracking().Where(item => item.Kind == PerformanceNotificationKind.CalibrationFinalized).ToListAsync();
        Assert.Equal(2, told.Count);
        Assert.Contains(told, item => item.RecipientEmployeeId == world.Of("Tarek Ayari").ReviewerEmployeeId && item.EnglishContext()!.Contains("1 of 1 ratings changed."));
        Assert.Contains(told, item => item.RecipientEmployeeId == world.Of("Karim Haddad").ReviewerEmployeeId && item.EnglishContext()!.Contains("No ratings changed."));
        Assert.All(await db.OutboxMessages.AsNoTracking().Where(item => item.Kind == PerformanceNotificationKind.CalibrationFinalized).Select(item => item.Payload).ToListAsync(),
            payload => Assert.DoesNotContain("Tarek", payload));

        // Repeating finalize changes nothing.
        var again = await FinalizeAsync(db, world);
        Assert.True(again.IsSuccess);
        Assert.Equal(1, await db.AuditEntries.CountAsync(item => item.Action == PerformanceAuditActions.CalibrationFinalized));
        Assert.Equal(2, await db.Notifications.CountAsync(item => item.Kind == PerformanceNotificationKind.CalibrationFinalized));
    }

    private static object Body(JsonElement current, object bands) => new
    {
        defaultMeasurementMethod = current.GetProperty("defaultMeasurementMethod").GetString(),
        suggestedObjectiveCountMin = current.GetProperty("suggestedObjectiveCountMin").GetInt32(),
        suggestedObjectiveCountMax = current.GetProperty("suggestedObjectiveCountMax").GetInt32(),
        planningDeadlineOffsetDays = current.GetProperty("planningDeadlineOffsetDays").GetInt32(),
        planAlignmentPolicy = current.GetProperty("planAlignmentPolicy").GetString(),
        nineBoxBands = bands,
        expectedVersion = current.GetProperty("version").GetUInt32(),
    };
}

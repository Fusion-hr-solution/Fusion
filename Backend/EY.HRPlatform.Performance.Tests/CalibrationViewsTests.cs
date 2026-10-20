using System.Net;
using System.Net.Http.Json;
using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Features.Calibration;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using static EY.HRPlatform.Performance.Tests.TestHelpers.CalibrationWorld;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Slice 5 views of one session: header, Distribution, People, Nine-box, the subject drawer, the finalize preview and changes.</summary>
public sealed class CalibrationViewsTests
{
    private static readonly Guid KhaledEmployee = Guid.NewGuid();
    private static readonly FacilitatorIdentity Khaled = new(Guid.NewGuid(), KhaledEmployee, "Khaled Sassi");

    private static readonly Person[] Cast =
    [
        new("Karim Haddad", "Omar Mansour"), new("Hamza Dridi", "Omar Mansour"), new("Rim Bouzid", "Omar Mansour"),
        new("Mehdi Toumi", "Hichem Gharsalli"), new("Walid Jaziri", "Hichem Gharsalli"), new("Olfa Mejri", "Hichem Gharsalli"),
        new("Tarek Ayari", "Mariam Gharbi"), new("Aicha Bouazizi", "Mariam Gharbi"), new("Fares Lachheb", "Mariam Gharbi"),
        new("Nesrine Ouali", "Mariam Gharbi"),
        new("Khaled Sassi", "Youssef Trabelsi", KhaledEmployee),
    ];

    /// <summary>Ten reviews in calibration, Nesrine still with Mariam; Rim's objectives at 42%; Mehdi released at 4 last cycle.</summary>
    private static async Task<World> ArrangeAsync(PerformanceDbContext db, TestStore store)
    {
        var world = await SeedAsync(db, store, Cast);
        await ReleasedEarlierAsync(db, store, world.Of("Mehdi Toumi"), 4);
        foreach (var (name, rating, potential) in new[]
        {
            ("Karim Haddad", 5, ReviewPotential.High), ("Hamza Dridi", 3, ReviewPotential.Developing), ("Rim Bouzid", 5, ReviewPotential.Growing),
            ("Mehdi Toumi", 2, ReviewPotential.Growing), ("Walid Jaziri", 2, ReviewPotential.Developing), ("Olfa Mejri", 3, ReviewPotential.Growing),
            ("Tarek Ayari", 4, ReviewPotential.Growing), ("Aicha Bouazizi", 4, ReviewPotential.High), ("Fares Lachheb", 3, ReviewPotential.Growing),
            ("Khaled Sassi", 4, ReviewPotential.High),
        })
            await SubmitManagerAsync(db, world.Of(name), rating, potential);
        await PlanAsync(db, world, world.Of("Rim Bouzid"), ("Ship the release dashboard", 60m, 30m), ("Automate the regression suite", 40m, 60m));
        var opened = await OpenAsync(db, world);
        Assert.True(opened.IsSuccess, opened.IsSuccess ? null : opened.Error.Message);
        var session = await db.CalibrationSessions.FindAsync(opened.Value.Id);
        session!.ReplaceFacilitators([Hr, Khaled], Hr.UserId, DateTime.UtcNow);
        await db.SaveChangesAsync();
        return world;
    }

    [Fact]
    public async Task The_header_counts_the_session_and_lists_outstanding_reviews_by_reviewer()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await ArrangeAsync(db, store);

        var session = await new GetCalibrationSessionHandler(db).Handle(new(world.Round.Id, Hr, true), default);
        var header = session.Value.Header!;
        Assert.Equal((10, 0, 0, 0, 1), (header.People, header.Discussed, header.RatingChanged, header.PotentialChanged, header.Outstanding));
        var mariam = Assert.Single(header.OutstandingByReviewer);
        Assert.Equal(("Mariam Gharbi", 1, "Nesrine Ouali"), (mariam.ReviewerName, mariam.Count, mariam.People[0]));
        // Omar and Hichem lenient; Rim against her objectives; Mehdi down two since FY26.
        Assert.Equal((4, 2), (header.Flags, header.FlaggedNotDiscussed));
        Assert.True(header.PotentialEnabled);
        Assert.Equal((2, 3), (header.BandLowTop, header.BandMidTop));
        Assert.Equal(4, header.Managers.Count);

        // Khaled never counts or sees his own review.
        var khaled = (await new GetCalibrationSessionHandler(db).Handle(new(world.Round.Id, Khaled, true), default)).Value.Header!;
        Assert.Equal(9, khaled.People);
        Assert.DoesNotContain(khaled.Managers, manager => manager.Name == "Youssef Trabelsi");
    }

    [Fact]
    public async Task Distribution_compares_levels_and_lists_reviewers_furthest_from_the_session_first()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await ArrangeAsync(db, store);
        Assert.True((await AdjustAsync(db, world, world.Of("Rim Bouzid"), 4, "Objectives at 42%.")).IsSuccess);

        var view = (await new GetCalibrationDistributionHandler(db).Handle(Query<CalibrationDistributionViewDto>(world, Hr), default)).Value;
        Assert.Equal((1, 2), (view.Levels.Single(level => level.Value == 5).Current, view.Levels.Single(level => level.Value == 5).Original));
        Assert.Equal((4, 3), (view.Levels.Single(level => level.Value == 4).Current, view.Levels.Single(level => level.Value == 4).Original));
        Assert.Equal(3.5m, view.SessionAverage);
        Assert.Equal(["Hichem Gharsalli", "Omar Mansour"], view.Managers.Take(2).Select(manager => manager.ReviewerName));
        var omar = view.Managers.Single(manager => manager.ReviewerName == "Omar Mansour");
        Assert.Equal((4.33m, 4.0m, 0.83m, true), (omar.OriginalAverage, omar.CurrentAverage, omar.Delta, omar.Lenient));
        Assert.Equal([0, 0, 1, 0, 2], omar.OriginalMix);
        Assert.False(view.Managers.Single(manager => manager.ReviewerName == "Mariam Gharbi").Lenient);
    }

    [Fact]
    public async Task People_groups_by_current_rating_with_flags_and_filters()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await ArrangeAsync(db, store);
        await AdjustAsync(db, world, world.Of("Rim Bouzid"), 4, "Objectives at 42%.");

        var all = (await new GetCalibrationPeopleHandler(db).Handle(Query<CalibrationPeopleViewDto>(world, Hr), default)).Value;
        Assert.Equal(10, all.Total);
        var four = all.Groups.Single(group => group.Value == 4);
        Assert.Equal((4, 3), (four.Count, four.OriginalCount));
        var rim = four.People.Single(person => person.Name == "Rim Bouzid");
        Assert.Equal((5, 4, 42m), (rim.OriginalRating, rim.CurrentRating, rim.Attainment));
        // 4 is still the top band (4–5), so her rating still disagrees with 42%.
        Assert.Equal(("RatingVsObjectives", 42m), (rim.Flags.Single().Kind, rim.Flags.Single().Attainment));
        var mehdi = all.Groups.Single(group => group.Value == 2).People.Single(person => person.Name == "Mehdi Toumi");
        var moved = Assert.Single(mehdi.Flags);
        Assert.Equal(("MovedSinceLastCycle", -2, "FY26"), (moved.Kind, moved.Moved, moved.Cycle));
        Assert.Equal((4, "FY26"), (mehdi.LastResult!.Rating, mehdi.LastResult.CycleName));
        Assert.Null(all.Groups.Single(group => group.Value == 5).People.Single().LastResult);

        var omar = world.Of("Karim Haddad").ReviewerEmployeeId;
        var filtered = (await new GetCalibrationPeopleHandler(db).Handle(Query<CalibrationPeopleViewDto>(world, Hr, new(Manager: omar)), default)).Value;
        Assert.Equal(3, filtered.Total);
        // Flagged includes everyone under a lenient reviewer.
        var flagged = (await new GetCalibrationPeopleHandler(db).Handle(Query<CalibrationPeopleViewDto>(world, Hr, new(Flagged: true)), default)).Value;
        Assert.Equal(6, flagged.Total);
        var search = (await new GetCalibrationPeopleHandler(db).Handle(Query<CalibrationPeopleViewDto>(world, Hr, new(Q: "tarek")), default)).Value;
        Assert.Equal("Tarek Ayari", search.Groups.SelectMany(group => group.People).Single().Name);
    }

    [Fact]
    public async Task The_nine_box_places_people_from_the_copied_bands_and_marks_moves()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await ArrangeAsync(db, store);
        await AdjustAsync(db, world, world.Of("Hamza Dridi"), 4, "Led the migration.", ReviewPotential.Growing);

        var view = (await new GetCalibrationNineBoxHandler(db).Handle(Query<CalibrationNineBoxViewDto>(world, Hr), default)).Value;
        Assert.Equal(9, view.Cells.Count);
        var topHigh = view.Cells.Single(cell => cell.Band == 2 && cell.Potential == ReviewPotential.High);
        Assert.Equal(["Aicha Bouazizi", "Karim Haddad", "Khaled Sassi"], topHigh.People.Select(person => person.Name));
        var hamza = view.Cells.Single(cell => cell.Band == 2 && cell.Potential == ReviewPotential.Growing).People.Single(person => person.Name == "Hamza Dridi");
        Assert.True(hamza.Moved);
        Assert.Contains(view.Cells.Single(cell => cell.Band == 0 && cell.Potential == ReviewPotential.Developing).People, person => person.Name == "Walid Jaziri");
    }

    [Fact]
    public async Task The_subject_detail_shows_objectives_reviewer_and_history_and_hides_a_facilitators_own_review()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await ArrangeAsync(db, store);
        var rim = world.Of("Rim Bouzid");
        await AdjustAsync(db, world, rim, 4, "Objectives at 42%.");

        var detail = (await new GetCalibrationSubjectDetailHandler(db).Handle(Query<CalibrationSubjectDetailDto>(world, Hr, reviewId: rim.Id), default)).Value;
        Assert.Equal(["Ship the release dashboard", "Automate the regression suite"], detail.Objectives.Select(objective => objective.Title));
        Assert.Equal((60m, 30m), (detail.Objectives[0].Weight, detail.Objectives[0].Progress));
        Assert.Equal("A strong year with clear delivery.", detail.ManagerSummary);
        Assert.Equal("Objectives at 42%.", detail.Rationale);
        Assert.Single(detail.History);
        Assert.True(detail.Reviewer!.Lenient);
        Assert.Equal(5, detail.Scale.Count);

        var own = await new GetCalibrationSubjectDetailHandler(db).Handle(Query<CalibrationSubjectDetailDto>(world, Khaled, reviewId: world.Of("Khaled Sassi").Id), default);
        Assert.Equal(FailureKind.NotFound, PerformanceErrors.Details(own.Error).Kind);
    }

    [Fact]
    public async Task The_finalize_preview_counts_changes_and_names_flagged_people_not_discussed()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await ArrangeAsync(db, store);
        await AdjustAsync(db, world, world.Of("Rim Bouzid"), 4, "Objectives at 42%.", discussion: CalibrationDiscussionState.Discussed);
        await AdjustAsync(db, world, world.Of("Hamza Dridi"), 3, "Ready for more.", ReviewPotential.Growing);
        await AdjustAsync(db, world, world.Of("Olfa Mejri"), 4, "Carried the team.");

        var preview = (await new GetCalibrationFinalizePreviewHandler(db).Handle(Query<CalibrationFinalizePreviewDto>(world, Hr), default)).Value;
        Assert.Equal((10, 1, 1, 1, 0), (preview.People, preview.RatingsUp, preview.RatingsDown, preview.PotentialUp, preview.PotentialDown));
        Assert.Equal((9, 1, 4), (preview.NotDiscussed, preview.Outstanding, preview.Reviewers));
        Assert.Equal("Mehdi Toumi", Assert.Single(preview.FlaggedNotDiscussed).Name);
    }

    [Fact]
    public async Task Changes_list_every_change_with_its_reason_after_finalization()
    {
        var store = TestStore.ForNewTenant();
        await using var db = store.NewContext();
        var world = await ArrangeAsync(db, store);
        await AdjustAsync(db, world, world.Of("Rim Bouzid"), 3, "Objectives at 42%.");
        await AdjustAsync(db, world, world.Of("Hamza Dridi"), 3, "Ready for more.", ReviewPotential.Growing);
        await SubmitManagerAsync(db, world.Of("Nesrine Ouali"), 4);
        Assert.True((await FinalizeAsync(db, world)).IsSuccess);

        var view = (await new GetCalibrationChangesHandler(db).Handle(Query<CalibrationChangesViewDto>(world, Hr), default)).Value;
        Assert.NotNull(view.FinalizedAt);
        Assert.Equal(["Rim Bouzid", "Hamza Dridi"], view.Changes.Select(change => change.Name));
        var rim = view.Changes[0];
        Assert.Equal((5, 3, "Objectives at 42%.", "Amira Khelifi"), (rim.OriginalRating, rim.FinalRating, rim.Reason, rim.ChangedBy));
        Assert.Equal(11, view.Levels.Sum(level => level.Current));
    }

    [Fact]
    public async Task Views_are_served_to_named_facilitators_only()
    {
        await using var factory = new PerformanceApiFactory();
        World world;
        await using (var db = factory.Store.NewContext())
            world = await ArrangeAsync(db, factory.Store);
        var path = $"/api/performance/review-rounds/{world.Round.Id}/calibration";
        EffectivePermissionGrant[] calibrator =
            [new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.ReviewCalibrate, PermissionScopes.Tenant)];
        using var amira = factory.CreateAuthenticatedClient(permissions: calibrator, userId: Hr.UserId);
        var people = await ReviewQuestionLibraryTests.ReadDataAsync(await amira.GetAsync($"{path}/people?flagged=true&q=bouzid"));
        Assert.Equal(1, people.GetProperty("total").GetInt32());
        foreach (var view in new[] { "distribution", "nine-box", "finalize-preview", "changes", $"subjects/{world.Of("Rim Bouzid").Id}" })
            Assert.Equal(HttpStatusCode.OK, (await amira.GetAsync($"{path}/{view}")).StatusCode);

        using var unnamed = factory.CreateAuthenticatedClient(permissions: calibrator, userId: Guid.NewGuid());
        Assert.Equal(HttpStatusCode.Forbidden, (await unnamed.GetAsync($"{path}/people")).StatusCode);
        using var reviewer = factory.CreateAuthenticatedClient(employeeId: world.Of("Rim Bouzid").ReviewerEmployeeId,
            permissions: [new(PerformancePermissions.CycleView, PermissionScopes.DirectReports)]);
        Assert.Equal(HttpStatusCode.Forbidden, (await reviewer.GetAsync($"{path}/distribution")).StatusCode);
    }

    private static GetCalibrationViewQuery<T> Query<T>(World world, FacilitatorIdentity actor, CalibrationFilter? filter = null, Guid? reviewId = null)
        => new(world.Round.Id, actor, filter ?? new(), true, reviewId);
}

using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Plans;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Your People is a server projection: recorded responsibility, action required first, server filters and paging.</summary>
public sealed class YourPeopleTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 12, 31);
    private static readonly PlanSubmissionFacts Ready = new(1, true, 100m, true, false, PlanAlignmentPolicy.Optional);

    private sealed record Arranged(TestStore Store, FakeCoreWorkforceClient Workforce, Guid CycleId, Guid Manager, Guid OtherManager);

    /// <summary>
    /// Rami is responsible for six people, one in each standing (two Approved); someone else's report sits in
    /// the same Cycle and must never appear.
    /// </summary>
    private static async Task<Arranged> ArrangeAsync()
    {
        var store = TestStore.ForNewTenant();
        var workforce = new FakeCoreWorkforceClient();
        var tenant = store.TenantId;
        var manager = Guid.NewGuid();
        var otherManager = Guid.NewGuid();
        var cycle = PerformanceCycle.CreateDraft(tenant, "FY2026", Start, End, Start.AddDays(30)).Activated();

        await using var db = store.NewContext();
        db.Cycles.Add(cycle);

        EmployeePlan Person(string name, Guid reviewer, decimal? weight)
        {
            var employee = Guid.NewGuid();
            var participant = Participant.Create(tenant, cycle.Id, employee, name, "Analyst", null, "Finance",
                reviewer, "Reviewer", byExplicitInclusion: false, reviewerAsOf: Start);
            db.Participants.Add(participant);
            var plan = EmployeePlan.Create(tenant, cycle.Id, participant.Id, employee, name, "Finance", reviewer, "Reviewer");
            db.EmployeePlans.Add(plan);
            if (weight is { } w)
                db.Objectives.Add(Objective.CreateEmployee(tenant, cycle.Id, plan.Id, employee, $"{name}'s objective", null, null,
                    Start, End, ObjectiveMeasurement.ManualPercentage(), w, null, null, Start, End));
            return plan;
        }

        db.Participants.Add(Participant.Create(tenant, cycle.Id, Guid.NewGuid(), "Nadia NotStarted", "Analyst", null, "Finance",
            manager, "Reviewer", byExplicitInclusion: false, reviewerAsOf: Start));
        Person("Dina Draft", manager, 60m);
        var returned = Person("Rhea Returned", manager, 100m);
        returned.Submit(returned.EmployeeId, Ready);
        returned.Return(manager, "Make it measurable.");
        var submitted = Person("Sami Submitted", manager, 100m);
        submitted.Submit(submitted.EmployeeId, Ready);
        foreach (var name in new[] { "Alya Approved", "Badr Approved" })
        {
            var approved = Person(name, manager, 100m);
            approved.Submit(approved.EmployeeId, Ready);
            approved.Approve(manager);
        }
        var foreign = Person("Omar Other", otherManager, 100m);
        foreign.Submit(foreign.EmployeeId, Ready);

        await db.SaveChangesAsync();
        return new Arranged(store, workforce, cycle.Id, manager, otherManager);
    }

    private static async Task<YourPeoplePageDto> PageAsync(
        Arranged f, YourPeopleFilter filter = YourPeopleFilter.All, int page = 1, int pageSize = 25, string? search = null, Guid? caller = null)
    {
        await using var db = f.Store.NewContext();
        var result = await new GetYourPeopleHandler(db, f.Workforce, f.Store.Tenant).Handle(
            new GetYourPeopleQuery(f.CycleId, new PlanActorContext(caller ?? f.Manager, IsAdmin: false, CanReviewReports: true),
                filter, search, page, pageSize), default);
        Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : null);
        return result.Value;
    }

    private static string[] Names(YourPeoplePageDto page) => page.Items.Select(m => m.EmployeeName!).ToArray();

    [Fact]
    public async Task Only_the_callers_recorded_responsibility_is_listed()
    {
        var f = await ArrangeAsync();

        var page = await PageAsync(f);

        Assert.Equal(6, page.TotalCount);
        Assert.DoesNotContain("Omar Other", Names(page));
        Assert.Equal(["Omar Other"], Names(await PageAsync(f, caller: f.OtherManager)));
    }

    [Fact]
    public async Task Active_round_stage_is_shown_only_for_the_callers_review_assignment()
    {
        var f = await ArrangeAsync();
        await using (var db = f.Store.NewContext())
        {
            var cycle = await db.Cycles.FindAsync(f.CycleId);
            var alya = await db.Participants.SingleAsync(p => p.CycleId == f.CycleId && p.DisplayName == "Alya Approved");
            var badr = await db.Participants.SingleAsync(p => p.CycleId == f.CycleId && p.DisplayName == "Badr Approved");
            var round = ReviewRound.CreateDraft(f.Store.TenantId, cycle!, "Mid-year", Start, End, true, true, false);
            var alyaSubject = ReviewRoundSubject.Create(f.Store.TenantId, round.Id, alya, f.Manager, "Rami Reviewer");
            var badrSubject = ReviewRoundSubject.Create(f.Store.TenantId, round.Id, badr, f.OtherManager, "Other Reviewer");
            var scale = RatingScale.CreateDefault(f.Store.TenantId);
            var scaleVersion = scale.CreateNextVersion(RatingScaleDefaults.Levels);
            var alyaReview = PerformanceReview.Open(f.Store.TenantId, round, alyaSubject, scaleVersion.Id, scaleVersion.LevelsJson, DateTime.UtcNow);
            var badrReview = PerformanceReview.Open(f.Store.TenantId, round, badrSubject, scaleVersion.Id, scaleVersion.LevelsJson, DateTime.UtcNow);
            round.Launch("{}", scaleVersion.Id, DateTime.UtcNow);
            db.RatingScales.Add(scale);
            db.RatingScaleVersions.Add(scaleVersion);
            db.ReviewRounds.Add(round);
            db.ReviewRoundSubjects.AddRange(alyaSubject, badrSubject);
            db.PerformanceReviews.AddRange(alyaReview, badrReview);
            await db.SaveChangesAsync();
        }

        var page = await PageAsync(f);

        Assert.True(page.HasActiveReviewRound);
        Assert.Equal(PerformanceReviewState.SelfAssessment, page.Items.Single(m => m.EmployeeName == "Alya Approved").Review?.State);
        Assert.Null(page.Items.Single(m => m.EmployeeName == "Badr Approved").Review);
    }

    [Fact]
    public async Task Plans_awaiting_the_callers_decision_come_first()
    {
        var f = await ArrangeAsync();

        var page = await PageAsync(f);

        Assert.Equal(
            ["Sami Submitted", "Alya Approved", "Badr Approved", "Rhea Returned", "Dina Draft", "Nadia NotStarted"],
            Names(page));
        Assert.True(page.Items[0].CanReview);
    }

    [Fact]
    public async Task Views_are_filtered_and_counted_by_the_server()
    {
        var f = await ArrangeAsync();

        var needsReview = await PageAsync(f, YourPeopleFilter.NeedsReview);
        var planning = await PageAsync(f, YourPeopleFilter.Planning);

        Assert.Equal(["Sami Submitted"], Names(needsReview));
        Assert.Equal(1, needsReview.MatchCount);
        Assert.Equal(6, needsReview.TotalCount);
        Assert.Equal(["Rhea Returned", "Dina Draft", "Nadia NotStarted"], Names(planning));
        Assert.Equal(new YourPeopleCountsDto(NeedsReview: 1, Planning: 3, Approved: 2, NoProgress: 2), planning.Counts);
    }

    [Fact]
    public async Task Team_standing_covers_the_whole_responsibility_whatever_the_view_or_search()
    {
        var f = await ArrangeAsync();

        var standing = (await PageAsync(f, YourPeopleFilter.NeedsReview, search: "sami")).Standing;

        // One person per planning state plus two Approved; the other manager's report never counts.
        Assert.Equal((6, 1, 1, 1, 1, 2), (standing.People, standing.NotStarted, standing.Draft, standing.Returned, standing.Submitted, standing.Approved));
        Assert.Equal(0, standing.ApprovedReporting);
        Assert.Equal(1, (await PageAsync(f, caller: f.OtherManager)).Standing.People);
    }

    [Fact]
    public async Task Pages_are_cut_by_the_server_after_ordering()
    {
        var f = await ArrangeAsync();

        var second = await PageAsync(f, page: 2, pageSize: 2);

        Assert.Equal(["Badr Approved", "Rhea Returned"], Names(second));
        Assert.Equal(6, second.MatchCount);
        Assert.Equal(2, second.PageSize);
    }

    [Fact]
    public async Task Search_narrows_matches_and_counts()
    {
        var f = await ArrangeAsync();

        var page = await PageAsync(f, search: "approved");

        Assert.Equal(["Alya Approved", "Badr Approved"], Names(page));
        Assert.Equal(new YourPeopleCountsDto(NeedsReview: 0, Planning: 0, Approved: 2, NoProgress: 2), page.Counts);
    }

    [Fact]
    public async Task A_draft_shows_its_allocation_but_never_progress_and_a_private_draft_cannot_be_opened()
    {
        var f = await ArrangeAsync();

        var draft = (await PageAsync(f, YourPeopleFilter.Planning)).Items.Single(m => m.EmployeeName == "Dina Draft");
        var approved = (await PageAsync(f, YourPeopleFilter.Approved)).Items[0];

        Assert.Equal(RosterPlanStatus.Draft, draft.Status);
        Assert.Equal(60m, draft.AllocatedWeight);
        Assert.Empty(draft.ObjectiveProgress);
        Assert.False(draft.CanView);
        Assert.Null(approved.AllocatedWeight);
    }
}

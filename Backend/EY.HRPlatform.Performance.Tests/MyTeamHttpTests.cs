using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// performance-team-workspace: Your People grouped by what needs the manager in each phase, with the phase's facts;
/// the manager is never in their own list; released team results only after release and only their recorded team.
/// </summary>
public sealed class MyTeamHttpTests
{
    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);
    private static readonly PlanSubmissionFacts Ready = new(1, true, 100m, true, false, PlanAlignmentPolicy.Optional);
    private static readonly EffectivePermissionGrant[] Manager =
        [new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self), new(PerformancePermissions.CycleView, PermissionScopes.DirectReports)];

    /// <summary>
    /// Lina reviews Nour and Sami and is herself a participant reviewed by Amira. Omar reviews Rim. In planning, Sami has
    /// submitted and Nour drafts; in execution both plans are approved and Nour's objective is off track with a reason.
    /// </summary>
    private sealed record World(PerformanceApiFactory Factory, PerformanceCycle Cycle, Guid Nour, Guid Sami, Guid Lina, Guid Amira, Guid Omar, Guid Rim);

    private static async Task<World> ArrangeAsync(bool execution)
    {
        var factory = new PerformanceApiFactory();
        var tenant = factory.Store.TenantId;
        var (nour, sami, lina, amira, omar, rim) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var start = Today.AddMonths(-2);
        var cycle = PerformanceCycle.CreateDraft(tenant, "FY2027", start, Today.AddMonths(10), execution ? Today.AddDays(-10) : Today.AddDays(20)).Activated();
        Participant P(Guid id, string name, Guid manager, string managerName)
            => Participant.Create(tenant, cycle.Id, id, name, null, null, "Learning", manager, managerName, false, start);
        var nourP = P(nour, "Nour", lina, "Lina");
        var samiP = P(sami, "Sami", lina, "Lina");
        var linaP = P(lina, "Lina", amira, "Amira");
        var rimP = P(rim, "Rim", omar, "Omar");

        await using var db = factory.Store.NewContext();
        db.Cycles.Add(cycle);
        db.Participants.AddRange(nourP, samiP, linaP, rimP);
        EmployeePlan Plan(Participant p, Guid manager, string managerName, string title, out Objective objective)
        {
            var plan = EmployeePlan.Create(tenant, cycle.Id, p.Id, p.EmployeeId, p.DisplayName, "Learning", manager, managerName);
            objective = Objective.CreateEmployee(tenant, cycle.Id, plan.Id, p.EmployeeId, title, null, null,
                start, cycle.EndDate, ObjectiveMeasurement.ManualPercentage(), 100m, null, null, start, cycle.EndDate);
            db.EmployeePlans.Add(plan);
            db.Objectives.Add(objective);
            return plan;
        }
        var samiPlan = Plan(samiP, lina, "Lina", "Coach the team", out _);
        samiPlan.Submit(sami, Ready);
        var nourPlan = Plan(nourP, lina, "Lina", "Migrate billing", out var nourObjective);
        var linaPlan = Plan(linaP, amira, "Amira", "Lead the platform", out _);
        linaPlan.Submit(lina, Ready);
        if (execution)
        {
            samiPlan.Approve(lina);
            nourPlan.Submit(nour, Ready);
            nourPlan.Approve(lina);
            var at = DateTime.UtcNow.AddDays(-3);
            nourObjective.ApplyManualPercentage(25m);
            nourObjective.ReportStatus(ObjectiveStatus.OffTrack, at);
            db.ProgressUpdates.Add(ProgressUpdate.RecordPercentage(tenant, cycle.Id, nourObjective.Id, nour, 25m, ObjectiveStatus.OffTrack,
                "Vendor API delayed to May", false, false));
        }
        await db.SaveChangesAsync();
        return new World(factory, cycle, nour, sami, lina, amira, omar, rim);
    }

    private static async Task<JsonElement> PeopleAsync(World w, Guid who)
    {
        using var client = w.Factory.CreateAuthenticatedClient(employeeId: who, permissions: Manager);
        using var response = await client.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/team/people");
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
    }

    private static (string Name, string Group)[] Rows(JsonElement page) => page.GetProperty("items").EnumerateArray()
        .Select(i => (i.GetProperty("employeeName").GetString()!, i.GetProperty("group").GetString()!)).ToArray();

    [Fact]
    public async Task In_planning_plans_waiting_for_the_manager_come_first_and_the_manager_is_never_listed()
    {
        var w = await ArrangeAsync(execution: false);
        await using var _ = w.Factory;

        var page = await PeopleAsync(w, w.Lina);
        Assert.Equal("Planning", page.GetProperty("phase").GetString());
        Assert.Equal([("Sami", "waiting"), ("Nour", "planning")], Rows(page));
        Assert.Equal(["waiting", "planning"], page.GetProperty("groups").EnumerateArray().Select(g => g.GetProperty("key").GetString()));
        var nour = page.GetProperty("items")[1].GetProperty("facts").GetProperty("planning");
        Assert.Equal(1, nour.GetProperty("objectives").GetInt32());

        // Amira reviews Lina: Lina is in Amira's list, never in her own.
        Assert.Equal([("Lina", "waiting")], Rows(await PeopleAsync(w, w.Amira)));
        // Omar sees only Rim.
        Assert.Equal([("Rim", "planning")], Rows(await PeopleAsync(w, w.Omar)));
    }

    [Fact]
    public async Task In_execution_people_who_need_the_manager_come_first_with_the_owners_reason()
    {
        var w = await ArrangeAsync(execution: true);
        await using var _ = w.Factory;

        var page = await PeopleAsync(w, w.Lina);
        Assert.Equal("Execution", page.GetProperty("phase").GetString());
        var items = page.GetProperty("items").EnumerateArray().ToArray();
        Assert.Equal("Nour", items[0].GetProperty("employeeName").GetString());
        var attention = items[0].GetProperty("facts").GetProperty("execution").GetProperty("attention");
        Assert.Equal("offTrack", attention.GetProperty("kind").GetString());
        Assert.Equal("Vendor API delayed to May", attention.GetProperty("reason").GetString());
        Assert.Equal("Migrate billing", attention.GetProperty("objectiveTitle").GetString());
        // Sami never updated: needs the manager too, for an update.
        Assert.Equal("noUpdate", items[1].GetProperty("facts").GetProperty("execution").GetProperty("attention").GetProperty("kind").GetString());
        Assert.All(items, i => Assert.Equal("needsYou", i.GetProperty("group").GetString()));
        var summary = page.GetProperty("summary");
        Assert.Equal(1, summary.GetProperty("status").GetProperty("offTrack").GetInt32());
        Assert.Equal(1, summary.GetProperty("updatedIn30Days").GetInt32());
    }

    [Fact]
    public async Task During_a_round_reviews_ready_for_the_manager_come_first()
    {
        var w = await ArrangeAsync(execution: true);
        await using var _ = w.Factory;
        var tenant = w.Factory.Store.TenantId;
        await using (var db = w.Factory.Store.NewContext())
        {
            var round = ReviewRound.CreateDraft(tenant, w.Cycle, "Mid-year", w.Cycle.StartDate, w.Cycle.EndDate, true, false, false);
            round.UpdateDraft(w.Cycle, "Mid-year", w.Cycle.StartDate, w.Cycle.EndDate, true, false, false, Today.AddDays(5), Today.AddDays(15), "[]");
            var scale = RatingScale.CreateDefault(tenant);
            var version = scale.CreateNextVersion(RatingScaleDefaults.Levels);
            foreach (var participant in await db.Participants.Where(p => p.EmployeeId == w.Nour || p.EmployeeId == w.Sami).ToListAsync())
            {
                var subject = ReviewRoundSubject.Create(tenant, round.Id, participant, w.Lina, "Lina");
                var review = PerformanceReview.Open(tenant, round, subject, version.Id, version.LevelsJson, DateTime.UtcNow);
                if (participant.EmployeeId == w.Nour) review.SubmitSelfAssessment(w.Nour, "My half", 3, DateTime.UtcNow);
                db.ReviewRoundSubjects.Add(subject);
                db.PerformanceReviews.Add(review);
            }
            round.Launch("{\"competencies\":[]}", version.Id, DateTime.UtcNow);
            db.RatingScales.Add(scale); db.RatingScaleVersions.Add(version); db.ReviewRounds.Add(round);
            await db.SaveChangesAsync();
        }

        var page = await PeopleAsync(w, w.Lina);
        Assert.Equal("Review", page.GetProperty("phase").GetString());
        Assert.Equal([("Nour", "ready"), ("Sami", "waiting")], Rows(page));
        var sami = page.GetProperty("items")[1].GetProperty("facts").GetProperty("review");
        Assert.Equal("notStarted", sami.GetProperty("selfState").GetString());
        var summary = page.GetProperty("summary");
        Assert.Equal(1, summary.GetProperty("reviewsReady").GetInt32());
        Assert.Equal("Nour", summary.GetProperty("firstReadyName").GetString());
    }

    [Fact]
    public async Task Team_results_count_only_released_reviews_of_the_managers_recorded_team()
    {
        var w = await ArrangeAsync(execution: true);
        await using var _ = w.Factory;
        var tenant = w.Factory.Store.TenantId;
        using var lina = w.Factory.CreateAuthenticatedClient(employeeId: w.Lina, permissions: Manager);
        async Task<JsonElement> ResultsAsync() => (await (await lina.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/team/results"))
            .Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

        // Reviews of Nour, Sami (by Lina), Lina (by Amira) and Rim (by Omar), released for all but Nour.
        await using (var db = w.Factory.Store.NewContext())
        {
            var round = ReviewRound.CreateDraft(tenant, w.Cycle, "Year-end", w.Cycle.StartDate, w.Cycle.EndDate, false, false, false);
            round.UpdateDraft(w.Cycle, "Year-end", w.Cycle.StartDate, w.Cycle.EndDate, false, false, false, null, Today.AddDays(5), "[]");
            var scale = RatingScale.CreateDefault(tenant);
            var version = scale.CreateNextVersion(RatingScaleDefaults.Levels);
            var reviewers = new Dictionary<Guid, (Guid Id, string Name)>
            {
                [w.Nour] = (w.Lina, "Lina"), [w.Sami] = (w.Lina, "Lina"), [w.Lina] = (w.Amira, "Amira"), [w.Rim] = (w.Omar, "Omar"),
            };
            var opened = new List<(PerformanceReview Review, Guid Subject)>();
            foreach (var participant in await db.Participants.ToListAsync())
            {
                var (reviewerId, reviewerName) = reviewers[participant.EmployeeId];
                var subject = ReviewRoundSubject.Create(tenant, round.Id, participant, reviewerId, reviewerName);
                var review = PerformanceReview.Open(tenant, round, subject, version.Id, version.LevelsJson, DateTime.UtcNow);
                review.SubmitManagerAssessment(reviewerId, "Done", RatingScaleDefaults.Levels[2].Value, DateTime.UtcNow);
                opened.Add((review, participant.EmployeeId));
                db.ReviewRoundSubjects.Add(subject);
                db.PerformanceReviews.Add(review);
            }
            round.Launch("{}", version.Id, DateTime.UtcNow);
            // Released for everyone but Nour.
            foreach (var (review, _) in opened.Where(o => o.Subject != w.Nour))
                review.Finalize("{}", RatingScaleDefaults.Levels[2].Value, FinalRatingSources.Manager, DateTime.UtcNow);
            db.RatingScales.Add(scale); db.RatingScaleVersions.Add(version); db.ReviewRounds.Add(round);
            await db.SaveChangesAsync();
        }

        var results = await ResultsAsync();
        Assert.Equal(1, results.GetProperty("released").GetInt32());
        var level = Assert.Single(results.GetProperty("levels").EnumerateArray(), l => l.GetProperty("count").GetInt32() > 0);
        Assert.Equal(["Sami"], level.GetProperty("people").EnumerateArray().Select(p => p.GetProperty("name").GetString()));
        Assert.Equal(["Sami"], results.GetProperty("notAcknowledged").EnumerateArray().Select(n => n.GetString()));
        Assert.DoesNotContain("average", results.GetRawText(), StringComparison.OrdinalIgnoreCase);

        // Someone with no released reviews of their own team gets nothing, before release or for another team.
        using var stranger = w.Factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: Manager);
        var none = (await (await stranger.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/team/results")).Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("data");
        Assert.Equal(0, none.GetProperty("released").GetInt32());
        Assert.Empty(none.GetProperty("levels").EnumerateArray());
    }

    [Fact]
    public async Task Another_tenants_cycle_is_not_found()
    {
        var w = await ArrangeAsync(execution: false);
        await using var _ = w.Factory;
        using var other = w.Factory.CreateAuthenticatedClient(tenantId: Guid.NewGuid(), employeeId: w.Lina, permissions: Manager);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/team/results")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/team/people")).StatusCode);
    }
}

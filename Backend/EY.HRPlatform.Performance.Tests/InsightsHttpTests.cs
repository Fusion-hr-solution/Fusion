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
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// performance-hr-insights: counts and shares by unit and manager for cycle administrators, sections with the phase,
/// the unit filter with its sub-units, owner-set status, final ratings and calibration changes, and the people behind
/// each figure. Managers get 403, another tenant's cycle 404.
/// </summary>
public sealed class InsightsHttpTests
{
    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);
    private static readonly PlanSubmissionFacts Ready = new(1, true, 100m, true, false, PlanAlignmentPolicy.Optional);
    private static readonly EffectivePermissionGrant[] Admin =
        [new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.CycleManage, PermissionScopes.Tenant)];
    private static readonly EffectivePermissionGrant[] Manager =
        [new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self), new(PerformancePermissions.CycleView, PermissionScopes.DirectReports)];

    private sealed record World(PerformanceApiFactory Factory, PerformanceCycle Cycle, Guid Engineering, Guid EngineeringA, Guid EngineeringB,
        Guid Finance, Guid Nour, Guid Sami, Guid Rim, Guid Lina, EmployeePlan NourPlan, Objective NourObjective);

    /// <summary>
    /// Engineering holds Engineering A (Nour) and Engineering B (Sami); Finance holds Rim. Lina reviews all three. Nour's
    /// approved objective is off track and aligned to the company objective; Sami's is approved with no status and not
    /// aligned; Rim has no plan.
    /// </summary>
    private static async Task<World> ArrangeAsync(bool execution)
    {
        var factory = new PerformanceApiFactory();
        var tenant = factory.Store.TenantId;
        var (eng, engA, engB, fin) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        factory.Core.OrgUnits[eng] = new WorkforceOrgUnitContext(eng, "Engineering", null, true, []);
        factory.Core.OrgUnits[engA] = new WorkforceOrgUnitContext(engA, "Engineering A", eng, true, [eng]);
        factory.Core.OrgUnits[engB] = new WorkforceOrgUnitContext(engB, "Engineering B", eng, true, [eng]);
        factory.Core.OrgUnits[fin] = new WorkforceOrgUnitContext(fin, "Finance", null, true, []);

        var (nour, sami, rim, lina) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var start = Today.AddMonths(-2);
        var cycle = PerformanceCycle.CreateDraft(tenant, "FY2027", start, Today.AddMonths(10), execution ? Today.AddDays(-10) : Today.AddDays(20)).Activated();
        Participant P(Guid id, string name, Guid unit, string unitName)
            => Participant.Create(tenant, cycle.Id, id, name, null, unit, unitName, lina, "Lina", false, start);
        var nourP = P(nour, "Nour", engA, "Engineering A");
        var samiP = P(sami, "Sami", engB, "Engineering B");
        var rimP = P(rim, "Rim", fin, "Finance");

        var company = Objective.CreateStrategic(tenant, cycle.Id, "Grow retention", null, lina, start, cycle.EndDate,
            ObjectiveMeasurement.ManualPercentage(), start, cycle.EndDate);
        company.Publish();
        var nourPlan = EmployeePlan.Create(tenant, cycle.Id, nourP.Id, nour, "Nour", "Engineering A", lina, "Lina");
        var nourObjective = Objective.CreateEmployee(tenant, cycle.Id, nourPlan.Id, nour, "Migrate billing", null, company.Id,
            start, cycle.EndDate, ObjectiveMeasurement.ManualPercentage(), 100m, start, cycle.EndDate, start, cycle.EndDate);
        var samiPlan = EmployeePlan.Create(tenant, cycle.Id, samiP.Id, sami, "Sami", "Engineering B", lina, "Lina");
        var samiObjective = Objective.CreateEmployee(tenant, cycle.Id, samiPlan.Id, sami, "Coach the team", null, null,
            start, cycle.EndDate, ObjectiveMeasurement.ManualPercentage(), 100m, null, null, start, cycle.EndDate);
        foreach (var (plan, owner) in new[] { (nourPlan, nour), (samiPlan, sami) })
        {
            plan.Submit(owner, Ready);
            plan.Approve(lina);
        }
        nourObjective.ApplyManualPercentage(25m);
        nourObjective.ReportStatus(ObjectiveStatus.OffTrack, DateTime.UtcNow.AddDays(-2));

        await using var db = factory.Store.NewContext();
        db.Cycles.Add(cycle);
        db.Participants.AddRange(nourP, samiP, rimP);
        db.Objectives.AddRange(company, nourObjective, samiObjective);
        db.EmployeePlans.AddRange(nourPlan, samiPlan);
        await db.SaveChangesAsync();
        return new World(factory, cycle, eng, engA, engB, fin, nour, sami, rim, lina, nourPlan, nourObjective);
    }

    private static async Task<JsonElement> InsightsAsync(World w, string query = "")
    {
        using var client = w.Factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: Admin);
        using var response = await client.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/insights{query}");
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
    }

    private static async Task<string[]> PeopleAsync(World w, string query)
    {
        using var client = w.Factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: Admin);
        using var response = await client.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/insights/people{query}");
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("items").EnumerateArray()
            .Select(i => i.GetProperty("name").GetString()!).ToArray();
    }

    [Fact]
    public async Task In_execution_plans_updates_owner_set_status_and_alignment_show_and_reviews_do_not()
    {
        var w = await ArrangeAsync(execution: true);
        await using var _ = w.Factory;

        var insights = await InsightsAsync(w);
        Assert.True(insights.GetProperty("showsExecution").GetBoolean());
        Assert.False(insights.GetProperty("showsReviews").GetBoolean());

        var total = insights.GetProperty("total");
        Assert.Equal(3, total.GetProperty("people").GetInt32());
        Assert.Equal(2, total.GetProperty("plansApproved").GetInt32());
        Assert.Equal(1, total.GetProperty("updatedIn30Days").GetInt32());
        Assert.Equal(1, total.GetProperty("status").GetProperty("offTrack").GetInt32());
        Assert.Equal(1, total.GetProperty("status").GetProperty("noStatus").GetInt32());
        Assert.Equal(1, total.GetProperty("aligned").GetInt32());
        Assert.Equal(JsonValueKind.Null, total.GetProperty("released").ValueKind);
        Assert.Equal(1, insights.GetProperty("neverApproved").GetInt32());
        Assert.Equal(1, insights.GetProperty("notAligned").GetInt32());
        var direction = Assert.Single(insights.GetProperty("direction").EnumerateArray());
        Assert.Equal(1, direction.GetProperty("alignedObjectives").GetInt32());

        // Furthest behind first: Engineering B updated 0 of 1, then Engineering A; Finance has no approved plan to update.
        Assert.Equal("Engineering B", insights.GetProperty("byUnit")[0].GetProperty("name").GetString());
        Assert.DoesNotContain("average", insights.GetRawText(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task In_planning_only_plans_show_with_the_units_furthest_behind_first()
    {
        var w = await ArrangeAsync(execution: false);
        await using var _ = w.Factory;

        var insights = await InsightsAsync(w);
        Assert.False(insights.GetProperty("showsExecution").GetBoolean());
        Assert.Equal(JsonValueKind.Null, insights.GetProperty("total").GetProperty("status").ValueKind);
        Assert.Equal("Finance", insights.GetProperty("byUnit")[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task A_unit_filter_counts_the_unit_and_everything_below_it()
    {
        var w = await ArrangeAsync(execution: true);
        await using var _ = w.Factory;

        var engineering = await InsightsAsync(w, $"?unitId={w.Engineering}");
        Assert.Equal(2, engineering.GetProperty("participants").GetInt32());
        Assert.Equal("Engineering", engineering.GetProperty("scopeName").GetString());
        Assert.Equal(["Engineering A", "Engineering B"],
            engineering.GetProperty("byUnit").EnumerateArray().Select(u => u.GetProperty("name").GetString()).OrderBy(n => n));
        Assert.Contains(engineering.GetProperty("units").EnumerateArray(), u => u.GetProperty("name").GetString() == "Engineering");

        Assert.Equal(["Nour", "Sami"], await PeopleAsync(w, $"?metric=plans-approved&unitId={w.Engineering}"));
        Assert.Equal(["Rim"], await PeopleAsync(w, "?metric=plans-not-approved"));
        Assert.Equal(["Sami"], await PeopleAsync(w, "?metric=not-updated"));
        Assert.Equal(["Nour"], await PeopleAsync(w, "?metric=at-risk-or-off-track"));
    }

    [Fact]
    public async Task After_release_ratings_are_final_with_calibration_changes_by_unit_and_by_manager()
    {
        var w = await ArrangeAsync(execution: true);
        await using var _ = w.Factory;
        var tenant = w.Factory.Store.TenantId;
        await using (var db = w.Factory.Store.NewContext())
        {
            var round = ReviewRound.CreateDraft(tenant, w.Cycle, "Year-end", w.Cycle.StartDate, w.Cycle.EndDate, false, false, true);
            round.UpdateDraft(w.Cycle, "Year-end", w.Cycle.StartDate, w.Cycle.EndDate, false, false, true, null, Today.AddDays(5), "[]");
            var scale = RatingScale.CreateDefault(tenant);
            var version = scale.CreateNextVersion(RatingScaleDefaults.Levels);
            var nourP = db.Participants.Single(p => p.EmployeeId == w.Nour);
            var samiP = db.Participants.Single(p => p.EmployeeId == w.Sami);
            var nourSubject = ReviewRoundSubject.Create(tenant, round.Id, nourP, w.Lina, "Lina");
            var samiSubject = ReviewRoundSubject.Create(tenant, round.Id, samiP, w.Lina, "Lina");
            var nourReview = PerformanceReview.Open(tenant, round, nourSubject, version.Id, version.LevelsJson, DateTime.UtcNow);
            var samiReview = PerformanceReview.Open(tenant, round, samiSubject, version.Id, version.LevelsJson, DateTime.UtcNow);
            round.Launch("{}", version.Id, DateTime.UtcNow);
            var (four, three) = (RatingScaleDefaults.Levels[3].Value, RatingScaleDefaults.Levels[2].Value);
            nourReview.SubmitManagerAssessment(w.Lina, "Strong", four, DateTime.UtcNow);
            nourReview.CompleteCalibration(three, calibrated: true);
            nourReview.Finalize("{}", three, FinalRatingSources.Calibration, DateTime.UtcNow);
            db.RatingScales.Add(scale); db.RatingScaleVersions.Add(version); db.ReviewRounds.Add(round);
            db.ReviewRoundSubjects.AddRange(nourSubject, samiSubject);
            db.PerformanceReviews.AddRange(nourReview, samiReview);
            await db.SaveChangesAsync();
        }

        var insights = await InsightsAsync(w);
        Assert.True(insights.GetProperty("showsReviews").GetBoolean());
        var total = insights.GetProperty("total");
        Assert.Equal(1, total.GetProperty("released").GetInt32());
        Assert.Equal(1, total.GetProperty("lowered").GetInt32());
        Assert.Equal(0, total.GetProperty("raised").GetInt32());
        var levels = total.GetProperty("levels").EnumerateArray().ToArray();
        Assert.Equal(1, levels.Single(l => l.GetProperty("value").GetInt32() == RatingScaleDefaults.Levels[2].Value).GetProperty("count").GetInt32());
        var manager = Assert.Single(insights.GetProperty("byManager").EnumerateArray());
        Assert.Equal("Lina", manager.GetProperty("name").GetString());
        Assert.Equal(2, manager.GetProperty("people").GetInt32());

        Assert.Equal(["Nour"], await PeopleAsync(w, $"?metric=level&level={RatingScaleDefaults.Levels[2].Value}"));
        Assert.Equal(["Nour"], await PeopleAsync(w, "?metric=not-acknowledged"));
        Assert.Equal(["Nour"], await PeopleAsync(w, "?metric=lowered"));
        Assert.Equal(["Nour", "Sami"], await PeopleAsync(w, $"?metric=reviews&managerId={w.Lina}"));
    }

    [Fact]
    public async Task Only_cycle_administrators_read_insights_and_another_tenant_finds_nothing()
    {
        var w = await ArrangeAsync(execution: true);
        await using var _ = w.Factory;

        using var manager = w.Factory.CreateAuthenticatedClient(employeeId: w.Lina, permissions: Manager);
        Assert.Equal(HttpStatusCode.Forbidden, (await manager.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/insights")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await manager.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/insights/people?metric=people")).StatusCode);

        using var other = w.Factory.CreateAuthenticatedClient(tenantId: Guid.NewGuid(), employeeId: Guid.NewGuid(), permissions: Admin);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/insights")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/insights/people?metric=people")).StatusCode);

        using var admin = w.Factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: Admin);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync($"/api/performance/cycles/{w.Cycle.Id}/insights/people?metric=salary")).StatusCode);
    }
}

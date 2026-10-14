using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// Overview is one projection composed from capabilities and recorded responsibility (performance-overview):
/// every capability mix × Cycle state yields the union of its sections, counts stay within responsibility,
/// and no section carries an averaged progress figure.
/// </summary>
public sealed class OverviewHttpTests
{
    public enum State { None, Draft, Planning, Execution, Closed }

    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);
    private static readonly PlanSubmissionFacts Ready = new(1, true, 100m, true, false, PlanAlignmentPolicy.Optional);

    private sealed record Arranged(PerformanceApiFactory Factory, Guid Nour, Guid Lina, Guid? CycleId,
        Guid? ReviewAssigneeId = null, Guid? ReviewRoundId = null);

    /// <summary>Lina reviews Nour and Sami. In execution Nour's plan is approved with one overdue objective.</summary>
    private static async Task<Arranged> ArrangeAsync(State state, bool adminAssignedReviewer = false, bool calibration = false)
    {
        var factory = new PerformanceApiFactory();
        var tenant = factory.Store.TenantId;
        var nour = Guid.NewGuid();
        var lina = Guid.NewGuid();
        if (state == State.None) return new Arranged(factory, nour, lina, null);
        var reviewAssignee = adminAssignedReviewer ? Guid.NewGuid() : lina;

        var start = Today.AddMonths(-2);
        var deadline = state == State.Planning ? Today.AddDays(20) : Today.AddDays(-10);
        var cycle = PerformanceCycle.CreateDraft(tenant, "FY2027", start, Today.AddMonths(10), deadline);
        if (state != State.Draft) cycle = cycle.Activated();

        Guid? reviewRoundId = null;
        await using var db = factory.Store.NewContext();
        db.Cycles.Add(cycle);
        if (state != State.Draft)
        {
            var nourParticipant = Participant.Create(tenant, cycle.Id, nour, "Nour", null, null, "Learning", lina, "Lina", false, start);
            var samiParticipant = Participant.Create(tenant, cycle.Id, Guid.NewGuid(), "Sami", null, null, "Learning", lina, "Lina", false, start);
            db.Participants.AddRange(nourParticipant, samiParticipant);
            var company = Objective.CreateStrategic(tenant, cycle.Id, "Grow retention", null, lina, start, cycle.EndDate,
                ObjectiveMeasurement.ManualPercentage(), start, cycle.EndDate);
            company.Publish();
            db.Objectives.Add(company);

            var plan = EmployeePlan.Create(tenant, cycle.Id, nourParticipant.Id, nour, "Nour", "Learning", lina, "Lina");
            var objective = Objective.CreateEmployee(tenant, cycle.Id, plan.Id, nour, "Ship the playbook", null, null,
                start, Today.AddDays(-1), ObjectiveMeasurement.ManualPercentage(), 100m, null, null, start, cycle.EndDate);
            db.EmployeePlans.Add(plan);
            db.Objectives.Add(objective);
            if (state is State.Execution or State.Closed)
            {
                plan.Submit(nour, Ready);
                plan.Approve(lina);
                objective.ApplyManualPercentage(40m);
            }

            if (state == State.Execution)
            {
                var round = ReviewRound.CreateDraft(tenant, cycle, "Mid-year", start, cycle.EndDate, true, false, calibration);
                round.UpdateDraft(cycle, "Mid-year", start, cycle.EndDate, true, false, calibration, Today.AddDays(5), Today.AddDays(15), "[]");
                reviewRoundId = round.Id;
                var ratingScale = RatingScale.CreateDefault(tenant);
                var scaleVersion = ratingScale.CreateNextVersion(RatingScaleDefaults.Levels);
                var assignedName = adminAssignedReviewer ? "Admin assigned reviewer" : "Lina";
                var nourSubject = ReviewRoundSubject.Create(tenant, round.Id, nourParticipant, reviewAssignee, assignedName);
                var samiSubject = ReviewRoundSubject.Create(tenant, round.Id, samiParticipant, reviewAssignee, assignedName);
                var nourReview = PerformanceReview.Open(tenant, round, nourSubject, scaleVersion.Id, scaleVersion.LevelsJson, DateTime.UtcNow);
                var samiReview = PerformanceReview.Open(tenant, round, samiSubject, scaleVersion.Id, scaleVersion.LevelsJson, DateTime.UtcNow);
                nourReview.SubmitSelfAssessment(nour, "My self-assessment", DateTime.UtcNow);
                samiReview.SubmitSelfAssessment(samiParticipant.EmployeeId, "Sami's self-assessment", DateTime.UtcNow);
                samiReview.SubmitManagerAssessment(reviewAssignee, "Ready", RatingScaleDefaults.Levels[0].Value, DateTime.UtcNow);
                round.Launch("{\"competencies\":[]}", scaleVersion.Id, DateTime.UtcNow);
                db.RatingScales.Add(ratingScale);
                db.RatingScaleVersions.Add(scaleVersion);
                db.ReviewRounds.Add(round);
                db.ReviewRoundSubjects.AddRange(nourSubject, samiSubject);
                db.PerformanceReviews.AddRange(nourReview, samiReview);
            }
        }
        if (state == State.Closed) cycle.Close();
        await db.SaveChangesAsync();
        return new Arranged(factory, nour, lina, cycle.Id, adminAssignedReviewer ? reviewAssignee : null, reviewRoundId);
    }

    private static readonly EffectivePermissionGrant[] Employee =
    [
        new(PerformancePermissions.CycleView, PermissionScopes.Self),
        new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self),
    ];
    private static readonly EffectivePermissionGrant[] Reviewer =
    [
        new(PerformancePermissions.CycleView, PermissionScopes.DirectReports),
    ];
    private static readonly EffectivePermissionGrant[] Admin =
    [
        new(PerformancePermissions.CycleView, PermissionScopes.Tenant),
        new(PerformancePermissions.CycleManage, PermissionScopes.Tenant),
    ];
    private static readonly EffectivePermissionGrant[] Calibrator =
    [
        new(PerformancePermissions.CycleView, PermissionScopes.DirectReports),
        new(PerformancePermissions.ReviewCalibrate, PermissionScopes.Tenant),
    ];

    private static (Func<Arranged, Guid?> Who, EffectivePermissionGrant[] Grants) As(string who) => who switch
    {
        "employee" => (f => f.Nour, Employee),
        "reviewer" => (f => f.Lina, Reviewer),
        "admin" => (_ => null, Admin),
        // Mixed: the recorded reviewer who also administers Performance.
        _ => (f => f.Lina, [.. Reviewer, .. Admin]),
    };

    private static async Task<JsonElement> OverviewAsync(Arranged f, string who)
    {
        var (employee, grants) = As(who);
        using var client = f.Factory.CreateAuthenticatedClient(employeeId: employee(f), permissions: grants);
        using var response = await client.GetAsync("/api/performance/overview");
        Assert.Equal(200, (int)response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
    }

    private static string[] Kinds(JsonElement overview)
        => overview.GetProperty("sections").EnumerateArray().Select(s => s.GetProperty("kind").GetString()!).ToArray();

    private static JsonElement Section(JsonElement overview, string kind)
        => overview.GetProperty("sections").EnumerateArray().Single(s => s.GetProperty("kind").GetString() == kind);

    [Theory]
    [InlineData(State.None, "employee", "noCycle")]
    [InlineData(State.None, "reviewer", "noCycle")]
    [InlineData(State.None, "admin", "noCycle")]
    [InlineData(State.None, "mixed", "noCycle")]
    [InlineData(State.Draft, "employee", "noCycle")]
    [InlineData(State.Draft, "reviewer", "noCycle")]
    [InlineData(State.Draft, "admin", "setupReadiness")]
    [InlineData(State.Draft, "mixed", "setupReadiness")]
    [InlineData(State.Planning, "employee", "myPlan")]
    [InlineData(State.Planning, "reviewer", "teamPlanning,direction")]
    [InlineData(State.Planning, "admin", "cycleOperation,direction")]
    [InlineData(State.Planning, "mixed", "teamPlanning,teamDirection,cycleOperation,direction")]
    [InlineData(State.Execution, "employee", "myPlan,myReview")]
    [InlineData(State.Execution, "reviewer", "teamPlanning,teamExecution,teamReviews,direction")]
    [InlineData(State.Execution, "admin", "cycleOperation,reviewOperation,direction")]
    [InlineData(State.Execution, "mixed", "teamPlanning,teamExecution,teamDirection,teamReviews,cycleOperation,reviewOperation,direction")]
    [InlineData(State.Closed, "employee", "closedCycle")]
    [InlineData(State.Closed, "reviewer", "closedCycle")]
    [InlineData(State.Closed, "admin", "closedCycle")]
    [InlineData(State.Closed, "mixed", "closedCycle")]
    public async Task Sections_are_the_union_of_what_applies(State state, string who, string expected)
    {
        var f = await ArrangeAsync(state);
        await using var _ = f.Factory;

        var overview = await OverviewAsync(f, who);

        Assert.Equal(expected.Split(','), Kinds(overview));
        // No section anywhere carries an averaged progress figure.
        Assert.DoesNotContain("average", overview.GetRawText(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Administrators_are_offered_to_create_a_cycle_and_others_are_not()
    {
        var f = await ArrangeAsync(State.None);
        await using var _ = f.Factory;

        Assert.Equal("CycleCreate", Section(await OverviewAsync(f, "admin"), "noCycle").GetProperty("create").GetProperty("workspace").GetString());
        Assert.Equal(JsonValueKind.Null, Section(await OverviewAsync(f, "employee"), "noCycle").GetProperty("create").ValueKind);
    }

    [Fact]
    public async Task An_unapproved_plan_shows_no_progress_and_an_executing_plan_states_its_facts()
    {
        var planning = await ArrangeAsync(State.Planning);
        await using (planning.Factory)
        {
            var draft = Section(await OverviewAsync(planning, "employee"), "myPlan");
            Assert.Equal("Draft", draft.GetProperty("standing").GetString());
            Assert.Equal(JsonValueKind.Null, draft.GetProperty("execution").ValueKind);
        }

        var executing = await ArrangeAsync(State.Execution);
        await using (executing.Factory)
        {
            var execution = Section(await OverviewAsync(executing, "employee"), "myPlan").GetProperty("execution");
            Assert.Equal(40m, execution.GetProperty("planProgress").GetDecimal());
            Assert.Equal(1, execution.GetProperty("overdueObjectiveCount").GetInt32());
            Assert.Equal(1, execution.GetProperty("reportingCount").GetInt32());
        }
    }

    [Fact]
    public async Task Team_counts_cover_only_recorded_responsibility()
    {
        var f = await ArrangeAsync(State.Execution);
        await using var _ = f.Factory;

        var planning = Section(await OverviewAsync(f, "reviewer"), "teamPlanning");
        var execution = Section(await OverviewAsync(f, "reviewer"), "teamExecution");

        Assert.Equal(2, planning.GetProperty("people").GetInt32());
        Assert.Equal(1, planning.GetProperty("notStarted").GetInt32());
        Assert.Equal(1, planning.GetProperty("approved").GetInt32());
        Assert.Equal(1, execution.GetProperty("peopleWithOverdue").GetInt32());

        // Someone else holding the same grant but no recorded responsibility gets no team sections.
        using var stranger = f.Factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: Reviewer);
        var other = (await (await stranger.GetAsync("/api/performance/overview")).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        Assert.DoesNotContain("teamPlanning", Kinds(other));
    }

    [Fact]
    public async Task Review_sections_follow_subject_reviewer_and_administrator_responsibility()
    {
        var f = await ArrangeAsync(State.Execution);
        await using var _ = f.Factory;

        var personal = Section(await OverviewAsync(f, "employee"), "myReview");
        Assert.Equal("ManagerAssessment", personal.GetProperty("openState").GetString());
        Assert.NotEqual(JsonValueKind.Null, personal.GetProperty("openReviewId").ValueKind);

        var team = Section(await OverviewAsync(f, "reviewer"), "teamReviews");
        Assert.Equal(1, team.GetProperty("assessmentsReady").GetInt32());

        var operation = Section(await OverviewAsync(f, "admin"), "reviewOperation");
        Assert.Equal("Mid-year", operation.GetProperty("reviewRoundName").GetString());
        Assert.Equal(1, operation.GetProperty("readyToFinalize").GetInt32());
        Assert.Equal("ReviewRound", operation.GetProperty("destination").GetProperty("workspace").GetString());
    }

    [Fact]
    public async Task Calibration_overview_is_available_to_a_calibrator_who_can_open_then_only_to_a_facilitator()
    {
        var f = await ArrangeAsync(State.Execution, calibration: true);
        await using var _ = f.Factory;
        var userId = Guid.NewGuid();
        using var client = f.Factory.CreateAuthenticatedClient(employeeId: f.Lina, permissions: Calibrator, userId: userId);

        var before = await (await client.GetAsync($"/api/performance/overview?cycleId={f.CycleId}"))
            .Content.ReadFromJsonAsync<JsonElement>();
        var section = Section(before.GetProperty("data"), "calibration");
        Assert.Equal(1, section.GetProperty("subjects").GetInt32());
        Assert.Equal(0, section.GetProperty("discussed").GetInt32());
        Assert.Equal(1, section.GetProperty("remaining").GetInt32());
        Assert.Equal(1, section.GetProperty("outstanding").GetInt32());
        Assert.Equal(JsonValueKind.Null, section.GetProperty("sessionState").ValueKind);
        Assert.Equal("Calibration", section.GetProperty("destination").GetProperty("workspace").GetString());
        Assert.Equal(f.ReviewRoundId, section.GetProperty("destination").GetProperty("reviewRoundId").GetGuid());

        using var opened = await client.PostAsync($"/api/performance/review-rounds/{f.ReviewRoundId}/calibration", content: null);
        Assert.Equal(200, (int)opened.StatusCode);
        var after = await (await client.GetAsync($"/api/performance/overview?cycleId={f.CycleId}"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Open", Section(after.GetProperty("data"), "calibration").GetProperty("sessionState").GetString());

        using var other = f.Factory.CreateAuthenticatedClient(employeeId: f.Lina, permissions: Calibrator);
        var otherOverview = await (await other.GetAsync($"/api/performance/overview?cycleId={f.CycleId}"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.DoesNotContain("calibration", Kinds(otherOverview.GetProperty("data")));
    }

    [Fact]
    public async Task Review_results_are_scoped_to_the_selected_cycle_and_closed_cycles_link_to_them()
    {
        var f = await ArrangeAsync(State.Execution);
        await using var _ = f.Factory;
        var oldCycleId = await AddClosedFinalizedReviewAsync(f.Factory, f.Nour, f.Lina);
        using var client = f.Factory.CreateAuthenticatedClient(employeeId: f.Nour, permissions: Employee);

        var selected = await (await client.GetAsync($"/api/performance/overview?cycleId={f.CycleId}"))
            .Content.ReadFromJsonAsync<JsonElement>();
        var myReview = Section(selected.GetProperty("data"), "myReview");
        Assert.Equal(0, myReview.GetProperty("finalizedReviewCount").GetInt32());
        Assert.Equal(JsonValueKind.Null, myReview.GetProperty("resultReviewId").ValueKind);

        var closed = await (await client.GetAsync($"/api/performance/overview?cycleId={oldCycleId}"))
            .Content.ReadFromJsonAsync<JsonElement>();
        var closedCycle = Section(closed.GetProperty("data"), "closedCycle");
        Assert.Equal(1, closedCycle.GetProperty("finalizedReviewCount").GetInt32());
        Assert.Equal("Reviews", closedCycle.GetProperty("reviews").GetProperty("workspace").GetString());
        Assert.Equal(oldCycleId, closedCycle.GetProperty("reviews").GetProperty("cycleId").GetGuid());
    }

    private static async Task<Guid> AddClosedFinalizedReviewAsync(PerformanceApiFactory factory, Guid subjectId, Guid reviewerId)
    {
        var tenant = factory.Store.TenantId;
        var start = Today.AddYears(-2);
        var end = Today.AddYears(-1);
        var cycle = PerformanceCycle.CreateDraft(tenant, "FY2025", start, end, end).Activated();
        var participant = Participant.Create(tenant, cycle.Id, subjectId, "Nour", null, null, "Learning", reviewerId, "Lina", false, start);
        var round = ReviewRound.CreateDraft(tenant, cycle, "Year-end", start, end, false, false, false);
        round.UpdateDraft(cycle, round.Name, start, end, false, false, false, null, end, "[]");
        var roundSubject = ReviewRoundSubject.Create(tenant, round.Id, participant, reviewerId, "Lina");
        var scale = RatingScale.CreateDefault(tenant);
        var scaleVersion = scale.CreateNextVersion(RatingScaleDefaults.Levels);
        var review = PerformanceReview.Open(tenant, round, roundSubject, scaleVersion.Id, scaleVersion.LevelsJson, DateTime.UtcNow);
        review.SubmitManagerAssessment(reviewerId, "Historical result", RatingScaleDefaults.Levels[0].Value, DateTime.UtcNow);
        round.Launch("{}", scaleVersion.Id, DateTime.UtcNow);
        review.Finalize("{}", RatingScaleDefaults.Levels[0].Value, FinalRatingSources.Manager, DateTime.UtcNow);
        round.Close();
        cycle.Close();

        await using var db = factory.Store.NewContext();
        db.Cycles.Add(cycle);
        db.Participants.Add(participant);
        db.RatingScales.Add(scale);
        db.RatingScaleVersions.Add(scaleVersion);
        db.ReviewRounds.Add(round);
        db.ReviewRoundSubjects.Add(roundSubject);
        db.PerformanceReviews.Add(review);
        await db.SaveChangesAsync();
        return cycle.Id;
    }

    [Fact]
    public async Task An_admin_assigned_reviewer_gets_review_work_without_plan_responsibility()
    {
        var f = await ArrangeAsync(State.Execution, adminAssignedReviewer: true);
        await using var _ = f.Factory;
        using var client = f.Factory.CreateAuthenticatedClient(employeeId: f.ReviewAssigneeId, permissions: Reviewer);

        var context = await (await client.GetAsync($"/api/performance/context?cycleId={f.CycleId}"))
            .Content.ReadFromJsonAsync<JsonElement>();
        var capabilities = context.GetProperty("data").GetProperty("capabilities");
        Assert.True(capabilities.GetProperty("hasReviewWork").GetBoolean());
        Assert.False(capabilities.GetProperty("isResponsibleReviewer").GetBoolean());

        var overview = await (await client.GetAsync($"/api/performance/overview?cycleId={f.CycleId}"))
            .Content.ReadFromJsonAsync<JsonElement>();
        var sections = overview.GetProperty("data").GetProperty("sections");
        Assert.Contains(sections.EnumerateArray(), section => section.GetProperty("kind").GetString() == "teamReviews");
        Assert.DoesNotContain(sections.EnumerateArray(), section => section.GetProperty("kind").GetString() == "teamPlanning");
        var reviews = sections.EnumerateArray().Single(section => section.GetProperty("kind").GetString() == "teamReviews");
        Assert.Equal(1, reviews.GetProperty("assessmentsReady").GetInt32());
    }

    [Fact]
    public async Task A_review_denied_by_detail_is_absent_from_work_history_and_overview_counts()
    {
        var f = await ArrangeAsync(State.Execution);
        await using var _ = f.Factory;
        Guid reviewId;
        await using (var db = f.Factory.Store.NewContext())
            reviewId = await db.PerformanceReviews.AsNoTracking().Select(review => review.Id).FirstAsync();

        using var stranger = f.Factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: Reviewer);
        using var detail = await stranger.GetAsync($"/api/performance/reviews/{reviewId}");
        Assert.Equal(403, (int)detail.StatusCode);

        var work = await (await stranger.GetAsync($"/api/performance/reviews/work?cycleId={f.CycleId}")).Content
            .ReadFromJsonAsync<JsonElement>();
        Assert.Empty(work.GetProperty("data").EnumerateArray());

        var history = await (await stranger.GetAsync($"/api/performance/reviews/history?cycleId={f.CycleId}")).Content
            .ReadFromJsonAsync<JsonElement>();
        Assert.Empty(history.GetProperty("data").EnumerateArray());

        var overview = await (await stranger.GetAsync($"/api/performance/overview?cycleId={f.CycleId}")).Content
            .ReadFromJsonAsync<JsonElement>();
        Assert.DoesNotContain("teamReviews", Kinds(overview.GetProperty("data")));
    }

    [Fact]
    public async Task Closed_cycle_continuity_offers_administrators_the_next_cycle()
    {
        var f = await ArrangeAsync(State.Closed);
        await using var _ = f.Factory;

        var admin = Section(await OverviewAsync(f, "admin"), "closedCycle");
        var employee = Section(await OverviewAsync(f, "employee"), "closedCycle");

        Assert.Equal(1, admin.GetProperty("approvedCount").GetInt32());
        Assert.Equal("CycleCreate", admin.GetProperty("next").GetProperty("workspace").GetString());
        Assert.Equal(JsonValueKind.Null, employee.GetProperty("next").ValueKind);
        Assert.Equal(40m, employee.GetProperty("myPlanProgress").GetDecimal());
    }

    [Fact]
    public async Task A_cycle_of_another_tenant_is_not_found()
    {
        var f = await ArrangeAsync(State.Planning);
        await using var _ = f.Factory;
        using var client = f.Factory.CreateAuthenticatedClient(employeeId: f.Nour, permissions: Employee);

        using var response = await client.GetAsync($"/api/performance/overview?cycleId={Guid.NewGuid()}");

        Assert.Equal(404, (int)response.StatusCode);
    }
}

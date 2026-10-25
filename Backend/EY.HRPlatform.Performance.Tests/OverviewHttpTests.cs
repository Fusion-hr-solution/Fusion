using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Conversations;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.Performance.Features.Overview;
using EY.HRPlatform.Performance.Features.Settings;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// Overview is one projection composed from capabilities and recorded responsibility (performance-overview): the year,
/// then rows in a fixed order. Every capability mix × Cycle state yields the union of its rows, counts stay within
/// responsibility, and no row carries an averaged figure.
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
                nourReview.SubmitSelfAssessment(nour, "My self-assessment", 3, DateTime.UtcNow);
                samiReview.SubmitSelfAssessment(samiParticipant.EmployeeId, "Sami's self-assessment", 3, DateTime.UtcNow);
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

    private static (Func<Arranged, Guid?> Who, EffectivePermissionGrant[] Grants) As(string who) => who switch
    {
        "employee" => (f => f.Nour, Employee),
        "reviewer" => (f => f.Lina, Reviewer),
        "admin" => (_ => null, Admin),
        // Mixed: the recorded reviewer who also administers Performance.
        _ => (f => f.Lina, [.. Reviewer, .. Admin]),
    };

    private static async Task<JsonElement> OverviewAsync(Arranged f, string who, Guid? cycleId = null)
    {
        var (employee, grants) = As(who);
        using var client = f.Factory.CreateAuthenticatedClient(employeeId: employee(f), permissions: grants);
        using var response = await client.GetAsync(cycleId is null ? "/api/performance/overview" : $"/api/performance/overview?cycleId={cycleId}");
        Assert.Equal(200, (int)response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
    }

    private static async Task<JsonElement> OverviewAsync(HttpClient client, Guid? cycleId = null)
        => (await (await client.GetAsync(cycleId is null ? "/api/performance/overview" : $"/api/performance/overview?cycleId={cycleId}"))
            .Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

    private static string[] Kinds(JsonElement overview)
        => overview.GetProperty("rows").EnumerateArray().Select(s => s.GetProperty("kind").GetString()!).ToArray();

    private static JsonElement Row(JsonElement overview, string kind)
        => overview.GetProperty("rows").EnumerateArray().Single(s => s.GetProperty("kind").GetString() == kind);

    [Theory]
    [InlineData(State.None, "employee", "noCycle")]
    [InlineData(State.None, "reviewer", "noCycle")]
    [InlineData(State.None, "admin", "noCycle")]
    [InlineData(State.None, "mixed", "noCycle")]
    [InlineData(State.Draft, "employee", "noCycle")]
    [InlineData(State.Draft, "reviewer", "noCycle")]
    [InlineData(State.Draft, "admin", "cycle")]
    [InlineData(State.Draft, "mixed", "cycle")]
    [InlineData(State.Planning, "employee", "ownPlan,direction")]
    [InlineData(State.Planning, "reviewer", "team,notParticipant,direction")]
    [InlineData(State.Planning, "admin", "cycle,direction")]
    [InlineData(State.Planning, "mixed", "cycle,team,notParticipant,direction")]
    [InlineData(State.Execution, "employee", "ownReview,ownPlan,direction")]
    [InlineData(State.Execution, "reviewer", "reviewsYouWrite,notParticipant,team,direction")]
    [InlineData(State.Execution, "admin", "cycle,direction")]
    [InlineData(State.Execution, "mixed", "cycle,reviewsYouWrite,notParticipant,team,direction")]
    [InlineData(State.Closed, "employee", "direction")]
    [InlineData(State.Closed, "reviewer", "team,notParticipant,direction")]
    [InlineData(State.Closed, "admin", "nextCycle,cycle,direction")]
    [InlineData(State.Closed, "mixed", "nextCycle,cycle,team,notParticipant,direction")]
    public async Task Rows_are_the_union_of_what_applies_in_a_fixed_order(State state, string who, string expected)
    {
        var f = await ArrangeAsync(state);
        await using var _ = f.Factory;

        var overview = await OverviewAsync(f, who);

        Assert.Equal(expected.Split(','), Kinds(overview));
        // No row anywhere carries an averaged figure.
        Assert.DoesNotContain("average", overview.GetRawText(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task The_year_shows_the_phase_and_counts_down_to_the_viewers_next_date()
    {
        var f = await ArrangeAsync(State.Planning);
        await using var _ = f.Factory;

        var year = (await OverviewAsync(f, "employee")).GetProperty("year");
        Assert.Equal("Planning", year.GetProperty("currentPhase").GetString());
        Assert.Equal("plans-due", year.GetProperty("next").GetProperty("kind").GetString());
        Assert.Equal(20, year.GetProperty("daysLeft").GetInt32());
        var phases = year.GetProperty("phases").EnumerateArray().ToArray();
        Assert.Equal(["Planning", "Execution", "Review"], phases.Select(p => p.GetProperty("name").GetString()));
        Assert.Equal("Current", phases[0].GetProperty("state").GetString());
        Assert.True(phases[2].GetProperty("estimated").GetBoolean());
    }

    [Fact]
    public async Task With_no_cycle_administrators_see_what_the_first_cycle_would_start_from()
    {
        var f = await ArrangeAsync(State.None);
        await using var _ = f.Factory;
        var unit = new WorkforceOrgSnapshot(Guid.NewGuid(), "Learning");
        var ceo = new WorkforceSnapshot(Guid.NewGuid(), "E-1", "Sami Ben Youssef", "Sami Ben Youssef", null, "CEO", true, unit, null);
        f.Factory.Core.AllActive.Add(ceo);
        f.Factory.Core.AllActive.Add(new WorkforceSnapshot(Guid.NewGuid(), "E-2", "Nour", "Nour", null, null, true, unit,
            new WorkforceManagerSnapshot(ceo.EmployeeId, ceo.DisplayName, true)));

        var admin = Assert.Single((await OverviewAsync(f, "admin")).GetProperty("rows").EnumerateArray());
        var readiness = admin.GetProperty("readiness");
        Assert.True(readiness.GetProperty("workforceAvailable").GetBoolean());
        Assert.Equal(2, readiness.GetProperty("people").GetInt32());
        Assert.Equal(1, readiness.GetProperty("withManager").GetInt32());
        Assert.Equal(["Sami Ben Youssef"], readiness.GetProperty("withoutManager").EnumerateArray().Select(n => n.GetString()));
        Assert.Equal(1, readiness.GetProperty("units").GetInt32());
        Assert.Equal(RatingScaleDefaults.Levels.Count, readiness.GetProperty("ratingLevels").GetInt32());

        // Readiness is administration's: an employee gets the row without it.
        var employee = Assert.Single((await OverviewAsync(f, "employee")).GetProperty("rows").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, employee.GetProperty("readiness").ValueKind);
    }

    [Fact]
    public async Task The_planning_deadline_stops_being_your_date_once_your_part_is_done()
    {
        var f = await ArrangeAsync(State.Planning);
        await using var _ = f.Factory;
        await using (var db = f.Factory.Store.NewContext())
        {
            var plan = await db.EmployeePlans.SingleAsync(p => p.EmployeeId == f.Nour);
            db.Entry(plan).Property(p => p.State).CurrentValue = PlanLifecycleState.Submitted;
            await db.SaveChangesAsync();
        }

        // Nour's plan is submitted: the next date that concerns her is the end of the year.
        Assert.Equal("cycle-end", (await OverviewAsync(f, "employee")).GetProperty("year").GetProperty("next").GetProperty("kind").GetString());
        // Lina still has plans to approve (Nour's waits, Sami has none): the deadline stays hers, and the administrator's.
        Assert.Equal("plans-due", (await OverviewAsync(f, "reviewer")).GetProperty("year").GetProperty("next").GetProperty("kind").GetString());
        Assert.Equal("plans-due", (await OverviewAsync(f, "admin")).GetProperty("year").GetProperty("next").GetProperty("kind").GetString());
    }

    [Fact]
    public async Task A_running_round_makes_review_the_current_phase()
    {
        var f = await ArrangeAsync(State.Execution);
        await using var _ = f.Factory;

        var overview = await OverviewAsync(f, "employee");
        Assert.Equal("Review", overview.GetProperty("phase").GetString());
        Assert.Equal("Review", overview.GetProperty("year").GetProperty("currentPhase").GetString());
    }

    [Fact]
    public void A_round_launched_before_planning_closes_starts_review_that_day_with_no_execution()
    {
        var tenant = Guid.NewGuid();
        var start = Today.AddDays(-20);
        var cycle = PerformanceCycle.CreateDraft(tenant, "FY2027", start, Today.AddMonths(11), Today.AddDays(10)).Activated();
        var round = ReviewRound.CreateDraft(tenant, cycle, "Year-end", start, cycle.EndDate, true, false, false);
        round.UpdateDraft(cycle, "Year-end", start, cycle.EndDate, true, false, false, Today.AddDays(5), Today.AddDays(15), "[]");
        round.Launch("{\"competencies\":[]}", Guid.NewGuid(), DateTime.UtcNow.AddDays(-1));

        var year = GetOverviewHandler.Year(cycle, [round], round, [], Today);

        Assert.Equal(["Planning", "Review"], year.Phases.Select(p => p.Name));
        Assert.Equal(Today.AddDays(-2), year.Phases[0].End);
        Assert.Equal(Today.AddDays(-1), year.Phases[1].Start);
        Assert.Equal("Review", year.CurrentPhase);
    }

    [Fact]
    public async Task A_closed_cycle_has_every_phase_done_and_no_next_date()
    {
        var f = await ArrangeAsync(State.Closed);
        await using var _ = f.Factory;

        var year = (await OverviewAsync(f, "employee")).GetProperty("year");
        Assert.All(year.GetProperty("phases").EnumerateArray(), p => Assert.Equal("Done", p.GetProperty("state").GetString()));
        Assert.Equal(JsonValueKind.Null, year.GetProperty("next").ValueKind);
        Assert.NotEqual(JsonValueKind.Null, year.GetProperty("closedAt").ValueKind);
    }

    [Fact]
    public async Task Direction_disappears_without_published_direction()
    {
        var f = await ArrangeAsync(State.Planning);
        await using var _ = f.Factory;

        Assert.Equal(1, Row(await OverviewAsync(f, "employee"), "direction").GetProperty("count").GetInt32());

        await using (var db = f.Factory.Store.NewContext())
        {
            foreach (var company in db.Objectives.Where(o => o.OwnershipScope == ObjectiveOwnershipScope.Company))
                company.Archive();
            await db.SaveChangesAsync();
        }

        foreach (var who in new[] { "employee", "admin" })
            Assert.DoesNotContain("direction", Kinds(await OverviewAsync(f, who)));
    }

    [Fact]
    public async Task Administrators_are_offered_to_create_a_cycle_and_others_are_not()
    {
        var f = await ArrangeAsync(State.None);
        await using var _ = f.Factory;

        Assert.True(Row(await OverviewAsync(f, "admin"), "noCycle").GetProperty("canCreate").GetBoolean());
        Assert.False(Row(await OverviewAsync(f, "employee"), "noCycle").GetProperty("canCreate").GetBoolean());
    }

    [Fact]
    public async Task An_unapproved_plan_shows_no_progress_and_an_executing_plan_states_its_facts()
    {
        var planning = await ArrangeAsync(State.Planning);
        await using (planning.Factory)
        {
            var draft = Row(await OverviewAsync(planning, "employee"), "ownPlan");
            Assert.Equal("Draft", draft.GetProperty("standing").GetString());
            Assert.Equal(JsonValueKind.Null, draft.GetProperty("progress").ValueKind);
            Assert.Equal(1, draft.GetProperty("objectives").GetInt32());
        }

        var executing = await ArrangeAsync(State.Execution);
        await using (executing.Factory)
        {
            var plan = Row(await OverviewAsync(executing, "employee"), "ownPlan");
            Assert.Equal(40m, plan.GetProperty("progress").GetDecimal());
            Assert.Equal(1, plan.GetProperty("status").GetProperty("noStatus").GetInt32());
            Assert.StartsWith("/performance/plan?cycle=", plan.GetProperty("href").GetString());
        }
    }

    [Fact]
    public async Task Team_facts_cover_only_recorded_responsibility()
    {
        var f = await ArrangeAsync(State.Planning);
        await using var _ = f.Factory;

        var team = Row(await OverviewAsync(f, "reviewer"), "team");
        Assert.Equal(2, team.GetProperty("people").GetInt32());
        var plans = team.GetProperty("plans");
        Assert.Equal(2, plans.GetProperty("drafting").GetInt32() + plans.GetProperty("notStarted").GetInt32());
        Assert.Equal(2, team.GetProperty("chips").GetArrayLength());

        // Someone else holding the same grant but no recorded responsibility gets no team row.
        using var stranger = f.Factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: Reviewer);
        Assert.DoesNotContain("team", Kinds(await OverviewAsync(stranger)));
    }

    [Fact]
    public async Task Review_rows_follow_subject_reviewer_and_administrator_responsibility()
    {
        var f = await ArrangeAsync(State.Execution);
        await using var _ = f.Factory;

        var own = Row(await OverviewAsync(f, "employee"), "ownReview");
        Assert.Equal("ManagerAssessment", own.GetProperty("state").GetString());
        Assert.Equal("Mid-year", own.GetProperty("roundName").GetString());

        var writing = Row(await OverviewAsync(f, "reviewer"), "reviewsYouWrite");
        Assert.Equal(2, writing.GetProperty("total").GetInt32());
        Assert.Equal(1, writing.GetProperty("ready").GetInt32());
        Assert.Equal(1, writing.GetProperty("submitted").GetInt32());
        Assert.Equal("Nour", writing.GetProperty("firstReadyName").GetString());

        var review = Row(await OverviewAsync(f, "admin"), "cycle").GetProperty("review");
        Assert.Equal("Mid-year", review.GetProperty("roundName").GetString());
        Assert.Equal(1, review.GetProperty("managerSubmitted").GetInt32());
        Assert.Equal(2, review.GetProperty("managerTotal").GetInt32());
    }

    [Fact]
    public async Task The_cycle_row_states_the_facts_of_its_phase()
    {
        var planning = await ArrangeAsync(State.Planning);
        await using (planning.Factory)
        {
            var row = Row(await OverviewAsync(planning, "admin"), "cycle");
            Assert.Equal(2, row.GetProperty("participants").GetInt32());
            var plans = row.GetProperty("planning").GetProperty("plans");
            Assert.Equal(1, plans.GetProperty("drafting").GetInt32());
            Assert.Equal(1, plans.GetProperty("notStarted").GetInt32());
            var unit = Assert.Single(row.GetProperty("planning").GetProperty("furthestBehind").EnumerateArray());
            Assert.Equal("Learning", unit.GetProperty("name").GetString());
            Assert.Equal(JsonValueKind.Null, row.GetProperty("execution").ValueKind);
        }

        var executing = await ArrangeAsync(State.Execution);
        await using (executing.Factory)
        {
            var execution = Row(await OverviewAsync(executing, "admin"), "cycle").GetProperty("execution");
            Assert.Equal(1, execution.GetProperty("approvedPlans").GetInt32());
            Assert.Equal(1, execution.GetProperty("neverApproved").GetInt32());
            Assert.Equal(1, execution.GetProperty("status").GetProperty("noStatus").GetInt32());
        }
    }

    [Fact]
    public async Task Someone_outside_the_population_is_told_so_with_when_it_was_set()
    {
        var f = await ArrangeAsync(State.Planning);
        await using var _ = f.Factory;
        using var client = f.Factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(), permissions: Employee);
        var overview = await OverviewAsync(client);

        var row = Row(overview, "notParticipant");
        Assert.Equal("FY2027", row.GetProperty("cycleName").GetString());
        Assert.NotEqual(JsonValueKind.Null, row.GetProperty("populationSetAt").ValueKind);
        Assert.DoesNotContain("ownPlan", Kinds(overview));
    }

    [Fact]
    public async Task Conversations_show_without_any_cycle()
    {
        var f = await ArrangeAsync(State.None);
        await using var _ = f.Factory;
        await using (var db = f.Factory.Store.NewContext())
        {
            var now = DateTime.UtcNow;
            var (series, meeting) = OneOnOneSeries.Start(f.Factory.Store.TenantId, f.Lina, f.Nour, OneOnOneCadence.Weekly, f.Lina,
                now.AddDays(2), now, "Lina", "Nour");
            db.OneOnOneSeries.Add(series);
            db.OneOnOneMeetings.Add(meeting);
            await db.SaveChangesAsync();
        }

        var overview = await OverviewAsync(f, "employee");
        Assert.Equal(["noCycle", "conversations"], Kinds(overview));
        var meetingFact = Assert.Single(Row(overview, "conversations").GetProperty("meetings").EnumerateArray());
        Assert.Equal("Lina", meetingFact.GetProperty("with").GetString());
    }

    [Fact]
    public async Task A_released_result_shows_in_its_own_cycle_and_the_reviewer_counts_only_after_release()
    {
        var f = await ArrangeAsync(State.Execution);
        await using var _ = f.Factory;
        var oldCycleId = await AddClosedFinalizedReviewAsync(f.Factory, f.Nour, f.Lina);

        var closed = await OverviewAsync(f, "employee", oldCycleId);
        var result = Row(closed, "ownReview").GetProperty("result");
        Assert.Equal(RatingScaleDefaults.Levels[0].Value, result.GetProperty("level").GetInt32());
        Assert.Equal(RatingScaleDefaults.Levels[0].Label, result.GetProperty("label").GetString());
        Assert.Equal(JsonValueKind.Null, Row(await OverviewAsync(f, "employee", f.CycleId), "ownReview").GetProperty("result").ValueKind);

        Assert.Equal(1, Row(await OverviewAsync(f, "reviewer", oldCycleId), "team").GetProperty("results").GetProperty("released").GetInt32());
        Assert.Equal(JsonValueKind.Null, Row(await OverviewAsync(f, "reviewer", f.CycleId), "team").GetProperty("results").ValueKind);
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

        var rows = await OverviewAsync(client, f.CycleId);
        Assert.Contains("reviewsYouWrite", Kinds(rows));
        Assert.DoesNotContain("team", Kinds(rows));
        Assert.Equal(1, Row(rows, "reviewsYouWrite").GetProperty("ready").GetInt32());
    }

    [Fact]
    public async Task A_review_denied_by_detail_is_absent_from_work_history_and_overview()
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

        Assert.DoesNotContain("reviewsYouWrite", Kinds(await OverviewAsync(stranger, f.CycleId)));
    }

    [Fact]
    public async Task Closed_cycle_continuity_offers_administrators_the_next_cycle()
    {
        var f = await ArrangeAsync(State.Closed);
        await using var _ = f.Factory;

        var admin = await OverviewAsync(f, "admin");
        Assert.Equal(JsonValueKind.Null, Row(admin, "nextCycle").GetProperty("cycleId").ValueKind);
        Assert.Equal(1, Row(admin, "cycle").GetProperty("approvedPlans").GetInt32());
        Assert.Equal(0, Row(admin, "cycle").GetProperty("closed").GetProperty("released").GetInt32());
        Assert.DoesNotContain("nextCycle", Kinds(await OverviewAsync(f, "employee")));
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

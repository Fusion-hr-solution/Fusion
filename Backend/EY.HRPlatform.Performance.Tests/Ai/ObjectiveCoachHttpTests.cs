using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Audit;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Features.Ai;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Ai;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Ai;

/// <summary>
/// The AI objective coach end to end over HTTP with a scripted provider: authority per composer,
/// allowed parents, server-side validation, quiet unavailability, and a content-free audit.
/// </summary>
public sealed class ObjectiveCoachHttpTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 12, 31);

    private sealed record World(
        PerformanceApiFactory Factory,
        Guid CycleId,
        Guid StrategyId,
        Guid TalentObjectiveId,
        Guid DeliveryObjectiveId,
        Guid TalentPodId,
        Guid NourId,
        Guid SamiId) : IAsyncDisposable
    {
        public HttpClient Sami() => Factory.CreateAuthenticatedClient(employeeId: SamiId, permissions:
            [new(PerformancePermissions.CycleView, PermissionScopes.Self), new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self)]);

        public HttpClient Nour() => Factory.CreateAuthenticatedClient(employeeId: NourId, permissions:
            [new(PerformancePermissions.CycleView, PermissionScopes.DirectReports), new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self),
             new(PerformancePermissions.ObjectiveOrgManage, PermissionScopes.Tenant)]);

        public string Url => $"/api/performance/cycles/{CycleId}/objective-coach";

        public ValueTask DisposeAsync() => Factory.DisposeAsync();
    }

    private static async Task<World> ArrangeAsync(bool closed = false)
    {
        var factory = new PerformanceApiFactory();
        var tenant = factory.Store.TenantId;
        var workforce = factory.Core;
        var talentPod = Guid.NewGuid();
        var delivery = Guid.NewGuid();
        var coo = workforce.Add("Coralie Ops");
        var nour = workforce.Add("Nour Lead", orgUnitId: talentPod, orgUnitName: "Talent Pod");
        var sami = workforce.Add("Sami Member", orgUnitId: talentPod, orgUnitName: "Talent Pod");
        var deliveryOwner = workforce.Add("Delia Owner", orgUnitId: delivery, orgUnitName: "Delivery Pod");
        workforce.OrgUnits[talentPod] = new WorkforceOrgUnitContext(talentPod, "Talent Pod", null, true, []);
        workforce.OrgUnits[delivery] = new WorkforceOrgUnitContext(delivery, "Delivery Pod", null, true, []);

        var cycle = PerformanceCycle.CreateDraft(tenant, "FY2026", Start, End, Start.AddDays(30)).Activated();
        var strategy = Objective.CreateStrategic(tenant, cycle.Id, "Grow the company", null, coo.EmployeeId,
            Start, End, ObjectiveMeasurement.ManualPercentage(), Start, End);
        strategy.Publish();
        var talent = Objective.CreateOrganizational(tenant, cycle.Id, talentPod, "Talent Pod", "Grow talent", null,
            nour.EmployeeId, strategy.Id, Start, End, ObjectiveProgressSource.Direct, ObjectiveMeasurement.ManualPercentage(),
            Start, End, Start, End);
        talent.Publish();
        var deliveryObjective = Objective.CreateOrganizational(tenant, cycle.Id, delivery, "Delivery Pod", "Ship faster", null,
            deliveryOwner.EmployeeId, strategy.Id, Start, End, ObjectiveProgressSource.Direct, ObjectiveMeasurement.ManualPercentage(),
            Start, End, Start, End);
        deliveryObjective.Publish();
        var participant = Participant.Create(tenant, cycle.Id, sami.EmployeeId, "Sami Member", null, talentPod, "Talent Pod",
            nour.EmployeeId, "Nour Lead", false, Start);
        var plan = EmployeePlan.Create(tenant, cycle.Id, participant.Id, sami.EmployeeId, "Sami Member", "Talent Pod",
            nour.EmployeeId, "Nour Lead");
        if (closed) cycle.Close();

        await using (var db = factory.Store.NewContext())
        {
            db.Cycles.Add(cycle);
            db.Objectives.AddRange(strategy, talent, deliveryObjective);
            db.Participants.Add(participant);
            db.EmployeePlans.Add(plan);
            await db.SaveChangesAsync();
        }

        return new World(factory, cycle.Id, strategy.Id, talent.Id, deliveryObjective.Id, talentPod, nour.EmployeeId, sami.EmployeeId);
    }

    private static object Draft(string surface = "Plan", Guid? orgUnitId = null, object? measurement = null, Guid? parent = null) => new
    {
        surface,
        orgUnitId,
        title = "Improve onboarding",
        description = "New joiners take too long to get going.",
        measurement = measurement ?? new { method = "ManualPercentage" },
        parentObjectiveId = parent,
    };

    private static object Answer(object? title = null, object? measure = null, object? parent = null, string contract = "objective-coach/1") => new
    {
        contractVersion = contract,
        title = title ?? new { disposition = "abstain", text = (string?)null },
        measure = measure ?? new { disposition = "abstain", method = (string?)null, baseline = (decimal?)null, target = (decimal?)null, unit = (string?)null, direction = (string?)null, milestones = (object?)null },
        parent = parent ?? new { disposition = "abstain", targetKey = (string?)null },
    };

    private static object Numeric(decimal target, decimal? baseline = null, string unit = "days", string direction = "decrease") => new
    {
        disposition = "suggest", method = "numericTarget", baseline, target, unit, direction, milestones = (object?)null,
    };

    [Fact]
    public async Task Participant_gets_title_measure_and_parent_from_minimal_input_and_the_attempt_is_audited_without_content()
    {
        await using var w = await ArrangeAsync();
        w.Factory.Ai.Answer = Answer(
            title: new { disposition = "suggest", text = "Cut new-joiner time to productivity to 20 days" },
            measure: Numeric(20),
            parent: new { disposition = "suggest", targetKey = "t1" });
        using var sami = w.Sami();

        var result = await Data(await sami.PostAsJsonAsync(w.Url, Draft()));

        Assert.Equal("Suggested", result.GetProperty("outcome").GetString());
        Assert.Equal("Cut new-joiner time to productivity to 20 days", result.GetProperty("title").GetString());
        var measure = result.GetProperty("measure");
        Assert.Equal("NumericTarget", measure.GetProperty("method").GetString());
        Assert.Equal(JsonValueKind.Null, measure.GetProperty("baseline").ValueKind);
        Assert.Equal(20m, measure.GetProperty("target").GetDecimal());
        Assert.Equal("Decrease", measure.GetProperty("direction").GetString());
        // The author's own unit leads the allowed parents, so t1 is the Talent Pod objective.
        Assert.Equal(w.TalentObjectiveId, result.GetProperty("parentObjectiveId").GetGuid());

        var input = JsonSerializer.Serialize(Assert.Single(w.Factory.Ai.Requests).Input);
        Assert.Contains("Improve onboarding", input);
        foreach (var leaked in new[] { "Coralie", "Nour", "Sami", "Delia", w.StrategyId.ToString(), w.TalentObjectiveId.ToString(), w.SamiId.ToString() })
            Assert.DoesNotContain(leaked, input, StringComparison.OrdinalIgnoreCase);

        await using var db = w.Factory.Store.NewContext();
        var entry = Assert.Single(await db.AuditEntries.Where(e => e.Action == PerformanceAuditActions.AiGenerated).ToListAsync());
        Assert.Equal(w.CycleId, entry.CycleId);
        Assert.Equal(w.SamiId, entry.ActorEmployeeId);
        using var summary = JsonDocument.Parse(entry.Summary);
        Assert.Equal("objective-coach", summary.RootElement.GetProperty("feature").GetString());
        Assert.Equal(4, summary.RootElement.GetProperty("sources").GetInt32());
        Assert.Equal(3, summary.RootElement.GetProperty("suggestions").GetInt32());
        Assert.Equal("Suggested", summary.RootElement.GetProperty("outcome").GetString());
        foreach (var text in new[] { "Improve onboarding", "New joiners", "20 days", "Grow talent" })
            Assert.DoesNotContain(text, entry.Summary, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Suggestions_that_fail_the_composer_rules_are_dropped()
    {
        await using var w = await ArrangeAsync();
        w.Factory.Ai.Answer = Answer(
            title: new { disposition = "suggest", text = "  improve   ONBOARDING " },
            measure: Numeric(target: 10, baseline: 10),
            parent: new { disposition = "suggest", targetKey = "t99" });
        using var sami = w.Sami();

        var result = await Data(await sami.PostAsJsonAsync(w.Url, Draft()));

        Assert.Equal("NothingToSuggest", result.GetProperty("outcome").GetString());
        Assert.Equal(JsonValueKind.Null, result.GetProperty("title").ValueKind);
        Assert.Equal(JsonValueKind.Null, result.GetProperty("measure").ValueKind);
        Assert.Equal(JsonValueKind.Null, result.GetProperty("parentObjectiveId").ValueKind);
    }

    [Theory]
    [InlineData(90)]
    [InlineData(110)]
    public async Task Milestones_must_total_one_hundred(decimal second)
    {
        await using var w = await ArrangeAsync();
        w.Factory.Ai.Answer = Answer(measure: new
        {
            disposition = "suggest", method = "weightedMilestones", baseline = (decimal?)null, target = (decimal?)null,
            unit = (string?)null, direction = (string?)null,
            milestones = new[] { new { title = "Map the journey", weight = 40m }, new { title = "Ship the guide", weight = second - 40m } },
        });
        using var sami = w.Sami();

        var result = await Data(await sami.PostAsJsonAsync(w.Url, Draft()));

        Assert.Equal(second == 100 ? "Suggested" : "NothingToSuggest", result.GetProperty("outcome").GetString());
    }

    [Fact]
    public async Task Valid_milestones_survive_and_the_current_parent_is_not_suggested_again()
    {
        await using var w = await ArrangeAsync();
        w.Factory.Ai.Answer = Answer(
            measure: new
            {
                disposition = "suggest", method = "weightedMilestones", baseline = (decimal?)null, target = (decimal?)null,
                unit = (string?)null, direction = (string?)null,
                milestones = new[] { new { title = "Map the journey", weight = 40m }, new { title = "Ship the guide", weight = 60m } },
            },
            parent: new { disposition = "suggest", targetKey = "t1" });
        using var sami = w.Sami();

        var result = await Data(await sami.PostAsJsonAsync(w.Url, Draft(parent: w.TalentObjectiveId)));

        Assert.Equal(2, result.GetProperty("measure").GetProperty("milestones").GetArrayLength());
        Assert.Equal(JsonValueKind.Null, result.GetProperty("parentObjectiveId").ValueKind);
    }

    [Fact]
    public async Task Team_coach_offers_only_the_teams_eligible_parents()
    {
        await using var w = await ArrangeAsync();
        w.Factory.Ai.Answer = Answer(parent: new { disposition = "suggest", targetKey = "t1" });
        using var nour = w.Nour();

        var result = await Data(await nour.PostAsJsonAsync(w.Url, Draft("Team", w.TalentPodId)));

        var input = JsonSerializer.Serialize(Assert.Single(w.Factory.Ai.Requests).Input);
        Assert.DoesNotContain("Ship faster", input);
        Assert.Contains("Grow the company", input);
        Assert.Equal(w.StrategyId, result.GetProperty("parentObjectiveId").GetGuid());
    }

    [Fact]
    public async Task Plan_coach_needs_the_callers_own_participation()
    {
        await using var w = await ArrangeAsync();
        using var nour = w.Nour(); // has the self-manage grant but is not a participant

        using var response = await nour.PostAsJsonAsync(w.Url, Draft());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(w.Factory.Ai.Requests);
    }

    [Fact]
    public async Task Team_coach_needs_objective_authoring_authority()
    {
        await using var w = await ArrangeAsync();
        using var sami = w.Sami();

        using var response = await sami.PostAsJsonAsync(w.Url, Draft("Team", w.TalentPodId));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(w.Factory.Ai.Requests);
    }

    [Fact]
    public async Task Another_tenants_cycle_is_not_found()
    {
        await using var w = await ArrangeAsync();
        using var outsider = w.Factory.CreateAuthenticatedClient(tenantId: Guid.NewGuid(), employeeId: w.SamiId, permissions:
            [new(PerformancePermissions.CycleView, PermissionScopes.Self), new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self)]);

        using var response = await outsider.PostAsJsonAsync(w.Url, Draft());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(w.Factory.Ai.Requests);
    }

    [Fact]
    public async Task Closed_cycle_refuses_the_coach()
    {
        await using var w = await ArrangeAsync(closed: true);
        using var sami = w.Sami();

        using var response = await sami.PostAsJsonAsync(w.Url, Draft());

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Empty(w.Factory.Ai.Requests);
    }

    [Fact]
    public async Task Untitled_draft_is_invalid()
    {
        await using var w = await ArrangeAsync();
        using var sami = w.Sami();

        using var response = await sami.PostAsJsonAsync(w.Url, new { surface = "Plan", title = "  " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Oversized_draft_measure_never_reaches_the_provider()
    {
        await using var w = await ArrangeAsync();
        using var sami = w.Sami();
        var milestones = Enumerable.Range(1, 500).Select(i => new { title = $"Step {i}", weight = 0.2m }).ToArray();

        using var response = await sami.PostAsJsonAsync(w.Url, Draft(measurement: new { method = "WeightedMilestones", milestones }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(w.Factory.Ai.Requests);
    }

    [Fact]
    public async Task Switched_off_or_resting_ai_is_unavailable_without_a_call_or_an_audit()
    {
        await using var w = await ArrangeAsync();
        using var sami = w.Sami();

        w.Factory.Ai.IsAvailable = false;
        await AssertUnavailable(await sami.PostAsJsonAsync(w.Url, Draft()));
        w.Factory.Ai.IsAvailable = true;

        await using (var db = w.Factory.Store.NewContext())
        {
            var settings = EY.HRPlatform.Performance.Domain.Settings.CycleSettings.CreateDefault(w.Factory.Store.TenantId);
            settings.Update(MeasurementMethod.NumericTarget, 3, 6, 30, EY.HRPlatform.Performance.Domain.Settings.PlanAlignmentPolicy.AtLeastOneConnected,
                aiAssistanceEnabled: false);
            db.CycleSettings.Add(settings);
            await db.SaveChangesAsync();
        }
        await AssertUnavailable(await sami.PostAsJsonAsync(w.Url, Draft()));

        Assert.Empty(w.Factory.Ai.Requests);
        await using var check = w.Factory.Store.NewContext();
        Assert.False(await check.AuditEntries.AnyAsync(e => e.Action == PerformanceAuditActions.AiGenerated));
    }

    [Fact]
    public async Task Provider_failure_is_unavailable_and_audited_with_its_category()
    {
        await using var w = await ArrangeAsync();
        w.Factory.Ai.Failure = new AiProviderException(AiFailureCategory.Timeout, "Suggestions are unavailable right now.");
        using var sami = w.Sami();

        await AssertUnavailable(await sami.PostAsJsonAsync(w.Url, Draft()));

        await using var db = w.Factory.Store.NewContext();
        var entry = Assert.Single(await db.AuditEntries.Where(e => e.Action == PerformanceAuditActions.AiGenerated).ToListAsync());
        Assert.Contains("\"outcome\":\"Failed\"", entry.Summary);
        Assert.Contains("\"category\":\"Timeout\"", entry.Summary);
    }

    [Fact]
    public async Task Unreadable_answer_counts_against_the_provider()
    {
        await using var w = await ArrangeAsync();
        w.Factory.Ai.Answer = Answer(contract: "objective-coach/0");
        using var sami = w.Sami();

        await AssertUnavailable(await sami.PostAsJsonAsync(w.Url, Draft()));

        Assert.Equal(1, w.Factory.Ai.UnusableAnswers);
    }

    [Fact]
    public async Task One_person_is_limited_per_minute_without_reaching_the_provider_and_others_are_not()
    {
        await using var w = await ArrangeAsync();
        w.Factory.Ai.Answer = Answer();
        using var sami = w.Sami();

        for (var call = 0; call < ObjectiveCoachVersions.CallsPerMinute; call++)
            await Data(await sami.PostAsJsonAsync(w.Url, Draft()));
        using (var limited = await sami.PostAsJsonAsync(w.Url, Draft()))
            Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Equal(ObjectiveCoachVersions.CallsPerMinute, w.Factory.Ai.Requests.Count);

        // Another signed-in user (the partition is the user account) is unaffected.
        using var other = w.Sami();
        await Data(await other.PostAsJsonAsync(w.Url, Draft()));
    }

    private static async Task AssertUnavailable(HttpResponseMessage response)
    {
        using (response)
        {
            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            Assert.Contains("Performance.AiUnavailable", await response.Content.ReadAsStringAsync());
        }
    }

    private static async Task<JsonElement> Data(HttpResponseMessage response)
    {
        using (response)
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.IsSuccessStatusCode, $"{(int)response.StatusCode}: {body}");
            using var json = JsonDocument.Parse(body);
            return json.RootElement.GetProperty("data").Clone();
        }
    }
}

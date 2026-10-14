using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests;

public sealed class ReviewRoundsHttpTests
{
    [Fact]
    public async Task Round_routes_require_cycle_administration_and_population_assignment_is_tenant_scoped()
    {
        await using var factory = new PerformanceApiFactory();
        var start = new DateOnly(2026, 1, 1);
        var end = new DateOnly(2026, 12, 31);
        var cycle = PerformanceCycle.CreateDraft(factory.Store.TenantId, "FY26", start, end, start.AddDays(30)).Activated();
        var subject = factory.Core.Add("Subject");
        var recordedReviewer = factory.Core.Add("Recorded reviewer");
        var assignedReviewer = factory.Core.Add("Assigned reviewer");
        var participant = Participant.Create(factory.Store.TenantId, cycle.Id, subject.EmployeeId, subject.DisplayName,
            null, null, null, recordedReviewer.EmployeeId, recordedReviewer.DisplayName, false, start);
        await using (var db = factory.Store.NewContext())
        {
            db.Cycles.Add(cycle);
            db.Participants.Add(participant);
            db.CycleSettings.Add(CycleSettings.CreateDefault(factory.Store.TenantId));
            await db.SaveChangesAsync();
        }
        using var denied = factory.CreateAuthenticatedClient(permissions: [new(PerformancePermissions.CycleView, PermissionScopes.Tenant)]);
        using var forbidden = await denied.GetAsync($"/api/performance/cycles/{cycle.Id}/review-rounds");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        using var admin = factory.CreateAuthenticatedClient(permissions:
            [new(PerformancePermissions.CycleManage, PermissionScopes.Tenant), new(PerformancePermissions.CycleView, PermissionScopes.Tenant)]);
        using var create = await admin.PostAsJsonAsync($"/api/performance/cycles/{cycle.Id}/review-rounds",
            new { name = "Mid-year", periodStart = start, periodEnd = end });
        Assert.Equal(HttpStatusCode.OK, create.StatusCode);
        using var createdJson = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
        var round = createdJson.RootElement.GetProperty("data");
        var roundId = round.GetProperty("id").GetGuid();
        var version = round.GetProperty("version").GetUInt32();

        using var forbiddenReviewerDirectory = await denied.GetAsync($"/api/performance/review-rounds/{roundId}/eligible-reviewers");
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenReviewerDirectory.StatusCode);
        using var read = await admin.GetAsync($"/api/performance/review-rounds/{roundId}");
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        using var eligible = await admin.GetAsync($"/api/performance/review-rounds/{roundId}/eligible-reviewers");
        Assert.Equal(HttpStatusCode.OK, eligible.StatusCode);
        using var eligibleJson = JsonDocument.Parse(await eligible.Content.ReadAsStringAsync());
        Assert.Contains(eligibleJson.RootElement.GetProperty("data").EnumerateArray(), person =>
            person.GetProperty("employeeId").GetGuid() == assignedReviewer.EmployeeId);
        using var population = await admin.GetAsync($"/api/performance/review-rounds/{roundId}/population");
        Assert.Equal(HttpStatusCode.OK, population.StatusCode);
        using var update = await admin.PutAsJsonAsync($"/api/performance/review-rounds/{roundId}/population", new
        {
            expectedVersion = version,
            subjects = new[] { new { participantId = participant.Id, isExcluded = false, exclusionReason = (string?)null, reviewerEmployeeId = assignedReviewer.EmployeeId } },
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        using var updatedJson = JsonDocument.Parse(await update.Content.ReadAsStringAsync());
        var updated = updatedJson.RootElement.GetProperty("data")[0];
        Assert.Equal(assignedReviewer.EmployeeId, updated.GetProperty("reviewerEmployeeId").GetGuid());
        Assert.Equal(nameof(ReviewerBasis.AdministrativeAssignment), updated.GetProperty("reviewerBasis").GetString());

        using var latestRound = await admin.GetAsync($"/api/performance/review-rounds/{roundId}");
        using var latestRoundJson = JsonDocument.Parse(await latestRound.Content.ReadAsStringAsync());
        var latestVersion = latestRoundJson.RootElement.GetProperty("data").GetProperty("version").GetUInt32();
        using var launch = await admin.PostAsJsonAsync($"/api/performance/review-rounds/{roundId}/launch", new { expectedVersion = latestVersion });
        Assert.Equal(HttpStatusCode.OK, launch.StatusCode);
        using var launchRetry = await admin.PostAsJsonAsync($"/api/performance/review-rounds/{roundId}/launch", new { expectedVersion = version });
        Assert.Equal(HttpStatusCode.OK, launchRetry.StatusCode);
        using var status = await admin.GetAsync($"/api/performance/review-rounds/{roundId}/status");
        Assert.Equal(HttpStatusCode.OK, status.StatusCode);
        using var statusJson = JsonDocument.Parse(await status.Content.ReadAsStringAsync());
        Assert.Equal(roundId, statusJson.RootElement.GetProperty("data").GetProperty("reviewRoundId").GetGuid());
        using var reviewer = factory.CreateAuthenticatedClient(employeeId: assignedReviewer.EmployeeId,
            permissions: [new(PerformancePermissions.CycleView, PermissionScopes.DirectReports)]);
        using var work = await reviewer.GetAsync($"/api/performance/reviews/work?cycleId={cycle.Id}");
        Assert.Equal(HttpStatusCode.OK, work.StatusCode);
        using var workJson = JsonDocument.Parse(await work.Content.ReadAsStringAsync());
        Assert.Single(workJson.RootElement.GetProperty("data").EnumerateArray());

        using var otherTenant = factory.CreateAuthenticatedClient(tenantId: Guid.NewGuid(), permissions: [new(PerformancePermissions.CycleManage, PermissionScopes.Tenant)]);
        using var invisible = await otherTenant.GetAsync($"/api/performance/review-rounds/{roundId}");
        Assert.Equal(HttpStatusCode.NotFound, invisible.StatusCode);
        using var invisibleDirectory = await otherTenant.GetAsync($"/api/performance/review-rounds/{roundId}/eligible-reviewers");
        Assert.Equal(HttpStatusCode.NotFound, invisibleDirectory.StatusCode);
    }

    [Fact]
    public async Task Excluding_a_subject_does_not_revalidate_unchanged_recorded_reviewer()
    {
        await using var factory = new PerformanceApiFactory();
        var start = new DateOnly(2026, 1, 1);
        var end = new DateOnly(2026, 12, 31);
        var cycle = PerformanceCycle.CreateDraft(factory.Store.TenantId, "FY26", start, end, start.AddDays(30)).Activated();
        var person = factory.Core.Add("Subject");
        var historicalReviewerId = Guid.NewGuid();
        var participant = Participant.Create(factory.Store.TenantId, cycle.Id, person.EmployeeId, person.DisplayName,
            null, null, null, historicalReviewerId, "Recorded reviewer", false, start);
        await using (var db = factory.Store.NewContext())
        {
            db.Cycles.Add(cycle);
            db.Participants.Add(participant);
            db.CycleSettings.Add(CycleSettings.CreateDefault(factory.Store.TenantId));
            await db.SaveChangesAsync();
        }

        using var admin = factory.CreateAuthenticatedClient(permissions:
            [new(PerformancePermissions.CycleManage, PermissionScopes.Tenant), new(PerformancePermissions.CycleView, PermissionScopes.Tenant)]);
        using var create = await admin.PostAsJsonAsync($"/api/performance/cycles/{cycle.Id}/review-rounds",
            new { name = "Mid-year", periodStart = start, periodEnd = end });
        Assert.Equal(HttpStatusCode.OK, create.StatusCode);
        using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
        var data = created.RootElement.GetProperty("data");
        var roundId = data.GetProperty("id").GetGuid();
        var version = data.GetProperty("version").GetUInt32();

        using var update = await admin.PutAsJsonAsync($"/api/performance/review-rounds/{roundId}/population", new
        {
            expectedVersion = version,
            subjects = new[] { new { participantId = participant.Id, isExcluded = true, exclusionReason = "Outside this pilot.", reviewerEmployeeId = historicalReviewerId } },
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        using var updated = JsonDocument.Parse(await update.Content.ReadAsStringAsync());
        Assert.True(updated.RootElement.GetProperty("data")[0].GetProperty("isExcluded").GetBoolean());
        Assert.Equal(historicalReviewerId, updated.RootElement.GetProperty("data")[0].GetProperty("reviewerEmployeeId").GetGuid());
    }
}

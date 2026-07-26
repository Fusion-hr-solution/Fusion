using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Evaluations;

/// <summary>Task 14.3: tenant fail-closed across the five evaluation surfaces (scales, templates, rounds, assignments, work-entry queries).</summary>
public class EvaluationTenantIsolationTests
{
    private static readonly IPerformanceAccessPolicyService Access = new PerformanceAccessPolicyService();

    private static System.Security.Claims.ClaimsPrincipal HrPrincipal() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithFullName("HR Operator")
        .WithPermission(PerformancePermissions.EvaluationManage, PermissionScopes.Tenant)
        .WithPermission(PerformancePermissions.EvaluationOperate, PermissionScopes.Tenant)
        .Build();

    private static async Task<EvaluationTestScenario.Result> SeedAndLaunchAsync(string dbName, Guid tenantA)
    {
        await using var db = PerformanceTestContext.Create(tenantA, out _, dbName);
        return await EvaluationTestScenario.SeedAndLaunchFreshAsync(db, tenantA);
    }

    [Fact]
    public async Task ForeignTenant_ReadsZeroRowsAcrossEvaluationTables()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var dbName = $"eval-isolation-{Guid.NewGuid()}";
        await SeedAndLaunchAsync(dbName, tenantA);

        await using var foreignDb = PerformanceTestContext.Create(tenantB, out _, dbName);
        Assert.Empty(await foreignDb.EvaluationRatingScales.ToListAsync());
        Assert.Empty(await foreignDb.EvaluationTemplates.ToListAsync());
        Assert.Empty(await foreignDb.EvaluationRounds.ToListAsync());
        Assert.Empty(await foreignDb.EvaluationAssignments.ToListAsync());
    }

    [Fact]
    public async Task ForeignTenant_RosterQuery_DoesNotSeeAnotherTenantsRound()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var dbName = $"eval-isolation-roster-{Guid.NewGuid()}";
        var scenario = await SeedAndLaunchAsync(dbName, tenantA);

        await using var foreignDb = PerformanceTestContext.Create(tenantB, out _, dbName);
        var handler = new GetEvaluationAssignmentRosterQueryHandler(foreignDb, Access);
        var result = await handler.Handle(new GetEvaluationAssignmentRosterQuery(HrPrincipal(), scenario.RoundId), CancellationToken.None);

        // The round belongs to tenant A, so under tenant B it is not found — never a foreign roster.
        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task ForeignTenant_TeamQuery_ReturnsNoForeignAssignments()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var dbName = $"eval-isolation-team-{Guid.NewGuid()}";
        var scenario = await SeedAndLaunchAsync(dbName, tenantA);

        var foreignReviewer = scenario.Participants[0].ReviewerId;
        var teamPrincipal = new ClaimsPrincipalBuilder()
            .WithUserId(Guid.NewGuid())
            .WithEmployeeId(foreignReviewer)
            .WithPermission(PerformancePermissions.EvaluationTeamView, PermissionScopes.Tenant)
            .Build();

        await using var foreignDb = PerformanceTestContext.Create(tenantB, out _, dbName);
        var handler = new GetTeamEvaluationAssignmentsQueryHandler(foreignDb, Access);
        var result = await handler.Handle(new GetTeamEvaluationAssignmentsQuery(teamPrincipal), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value);
    }
}

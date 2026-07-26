using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Commands;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Services;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Evaluations;

/// <summary>
/// Task 14.1 (launch + deadline extension). Exercises the launch/extension handlers' decision
/// paths — permission, readiness gate, already-launched, and ordering — which resolve before the
/// persistence step. The successful launch's generated-assignment graph is covered by
/// <see cref="EvaluationAssignmentTests"/> via the seeder-style fresh insert, because EF InMemory
/// cannot persist the child-adding update the reload-based handler performs on an already-tracked
/// aggregate (a limitation of the in-memory provider, not the production Npgsql path).
/// </summary>
public class EvaluationRoundLaunchTests
{
    private static readonly IPerformanceAccessPolicyService Access = new PerformanceAccessPolicyService();

    private static System.Security.Claims.ClaimsPrincipal Operator() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithFullName("HR Operator")
        .WithPermission(PerformancePermissions.EvaluationOperate, PermissionScopes.Tenant)
        .Build();

    private static System.Security.Claims.ClaimsPrincipal ManagerOnly() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithPermission(PerformancePermissions.EvaluationManage, PermissionScopes.Tenant)
        .Build();

    private static LaunchEvaluationRoundCommandHandler LaunchHandler(PerformanceDbContext db, ITenantContext tenant)
        => new(db, Access, new EvaluationRoundReadinessResolver(db, new EffectiveReviewerResolver(db)), tenant, new ConfigurationAuditWriter(db));

    private static Task<uint> VersionAsync(PerformanceDbContext db, Guid roundId)
        => db.EvaluationRounds.AsNoTracking().Where(x => x.Id == roundId).Select(x => x.Version).SingleAsync();

    [Fact]
    public async Task Launch_WhenNotReady_ReturnsNotReady()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, $"launch-not-ready-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId, new(LockPlanning: false));

        var result = await LaunchHandler(db, tenant).Handle(
            new LaunchEvaluationRoundCommand(Operator(), scenario.RoundId, scenario.RoundVersion), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotReady", result.Error.Code);
    }

    [Fact]
    public async Task Launch_WithOnlyManagePermission_IsForbidden()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, $"launch-forbidden-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId);

        var result = await LaunchHandler(db, tenant).Handle(
            new LaunchEvaluationRoundCommand(ManagerOnly(), scenario.RoundId, scenario.RoundVersion), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code);
    }

    [Fact]
    public async Task Launch_OnAlreadyLaunchedRound_IsRefused()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, $"launch-already-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAndLaunchFreshAsync(db, tenantId, new(AssessmentModel: EvaluationAssessmentModel.ManagerOnly));

        var result = await LaunchHandler(db, tenant).Handle(
            new LaunchEvaluationRoundCommand(Operator(), scenario.RoundId, await VersionAsync(db, scenario.RoundId)), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("AlreadyLaunched", result.Error.Code);
    }

    [Fact]
    public async Task ExtendDeadline_OutOfOrder_IsRejected()
    {
        var tenantId = Guid.NewGuid();
        var managerDeadline = DateTime.UtcNow.AddDays(30);
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, $"extend-out-of-order-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAndLaunchFreshAsync(
            db, tenantId, new(AssessmentModel: EvaluationAssessmentModel.ManagerOnly, ManagerDeadline: managerDeadline));

        var handler = new ExtendEvaluationRoundDeadlineCommandHandler(db, Access, tenant, new ConfigurationAuditWriter(db));
        // Push the manager deadline past the finalization deadline (managerDeadline + 7) — rejected by the aggregate before any save.
        var result = await handler.Handle(new ExtendEvaluationRoundDeadlineCommand(
            Operator(), scenario.RoundId, EvaluationDeadlineKind.ManagerAssessment,
            managerDeadline.AddDays(30), "Too far", await VersionAsync(db, scenario.RoundId)), CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task ExtendDeadline_WithoutOperatePermission_IsForbidden()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, $"extend-forbidden-{Guid.NewGuid()}");
        var scenario = await EvaluationTestScenario.SeedAndLaunchFreshAsync(db, tenantId, new(AssessmentModel: EvaluationAssessmentModel.ManagerOnly));

        var handler = new ExtendEvaluationRoundDeadlineCommandHandler(db, Access, tenant, new ConfigurationAuditWriter(db));
        var result = await handler.Handle(new ExtendEvaluationRoundDeadlineCommand(
            ManagerOnly(), scenario.RoundId, EvaluationDeadlineKind.ManagerAssessment,
            DateTime.UtcNow.AddDays(33), "No permission", await VersionAsync(db, scenario.RoundId)), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code);
    }
}

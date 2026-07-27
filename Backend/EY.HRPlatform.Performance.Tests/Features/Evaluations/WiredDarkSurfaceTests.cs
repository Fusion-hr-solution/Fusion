using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.Evaluations.Configuration.Queries;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Commands;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Evaluations;

/// <summary>
/// The three surfaces the audit found built, contract-typed, and unreachable: template preview,
/// round-level participant exclusion, and reviewer reassignment. Wiring them up is only safe if
/// their authorization and tenant isolation hold, which nothing exercised until now.
/// </summary>
public sealed class WiredDarkSurfaceTests
{
    private static readonly PerformanceAccessPolicyService Access = new();

    private static ClaimsPrincipal Manager() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithFullName("HR Admin")
        .WithPermission(PerformancePermissions.EvaluationManage, PermissionScopes.Tenant)
        .Build();

    private static ClaimsPrincipal Bystander() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithFullName("Curious Employee")
        .Build();

    private static ClaimsPrincipal Operator() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithFullName("Evaluation Operator")
        .WithPermission(PerformancePermissions.EvaluationOperate, PermissionScopes.Tenant)
        .Build();

    private static ClaimsPrincipal Reviewer(Guid employeeId) => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithEmployeeId(employeeId)
        .WithFullName("Round Reviewer")
        .WithPermission(PerformancePermissions.EvaluationTeamView, PermissionScopes.Tenant)
        .Build();

    // ── Template preview ───────────────────────────────────────────────────────

    private static async Task<(Guid TenantId, string DbName, Guid TemplateId)> SeedTemplateAsync()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"dark-preview-{Guid.NewGuid()}";

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var scenario = await EvaluationTestScenario.SeedAsync(db, tenantId);
        return (tenantId, dbName, scenario.TemplateId);
    }

    [Fact]
    public async Task Preview_is_denied_without_evaluation_configuration_access()
    {
        var seeded = await SeedTemplateAsync();

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var result = await new PreviewEvaluationTemplateQueryHandler(db, Access).Handle(
            new PreviewEvaluationTemplateQuery(Bystander(), seeded.TemplateId, EvaluationTargetRater.Self),
            CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task Preview_answers_for_an_authorized_caller()
    {
        var seeded = await SeedTemplateAsync();

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var result = await new PreviewEvaluationTemplateQueryHandler(db, Access).Handle(
            new PreviewEvaluationTemplateQuery(Manager(), seeded.TemplateId, EvaluationTargetRater.Self),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(seeded.TemplateId, result.Value.TemplateId);
        Assert.Equal(EvaluationTargetRater.Self, result.Value.Rater);
    }

    [Fact]
    public async Task Preview_is_built_for_the_rater_that_was_asked_for()
    {
        var seeded = await SeedTemplateAsync();

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new PreviewEvaluationTemplateQueryHandler(db, Access);

        var self = await handler.Handle(
            new PreviewEvaluationTemplateQuery(Manager(), seeded.TemplateId, EvaluationTargetRater.Self),
            CancellationToken.None);
        var manager = await handler.Handle(
            new PreviewEvaluationTemplateQuery(Manager(), seeded.TemplateId, EvaluationTargetRater.Manager),
            CancellationToken.None);

        // The rater is what makes a preview meaningful: the two views must be distinguishable.
        Assert.Equal(EvaluationTargetRater.Self, self.Value.Rater);
        Assert.Equal(EvaluationTargetRater.Manager, manager.Value.Rater);
    }

    [Fact]
    public async Task Preview_of_another_tenants_template_answers_as_not_found()
    {
        var seeded = await SeedTemplateAsync();

        // Same database, different tenant: the global filter must hide it entirely.
        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _, seeded.DbName);
        var result = await new PreviewEvaluationTemplateQueryHandler(db, Access).Handle(
            new PreviewEvaluationTemplateQuery(Manager(), seeded.TemplateId, EvaluationTargetRater.Self),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Preview_works_before_a_template_is_published()
    {
        var seeded = await SeedTemplateAsync();

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var template = await db.EvaluationTemplates.SingleAsync(item => item.Id == seeded.TemplateId);

        // HR must be able to see what the participant will see while still deciding whether to
        // publish — a preview only available after publication is no use for that decision.
        Assert.NotEqual(EvaluationConfigStatus.Archived, template.Status);

        var result = await new PreviewEvaluationTemplateQueryHandler(db, Access).Handle(
            new PreviewEvaluationTemplateQuery(Manager(), seeded.TemplateId, EvaluationTargetRater.Self),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
    }

    // ── Round exclusion and reviewer reassignment ─────────────────────────────

    private static async Task<EvaluationTestScenario.Result> SeedLaunchedRoundAsync(
        Guid tenantId, string dbName)
    {
        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        return await EvaluationTestScenario.SeedAndLaunchFreshAsync(db, tenantId);
    }

    [Fact]
    public async Task Exclusion_is_denied_without_evaluation_operate_access()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"dark-exclude-deny-{Guid.NewGuid()}";
        var scenario = await SeedLaunchedRoundAsync(tenantId, dbName);

        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var round = await db.EvaluationRounds.SingleAsync(item => item.Id == scenario.RoundId);

        var result = await new SetEvaluationRoundExclusionCommandHandler(db, Access, new ActivityLogWriter(db, tenant, new StubCurrentUserContext())).Handle(
            new SetEvaluationRoundExclusionCommand(
                Bystander(), scenario.RoundId, scenario.Participants[0].EmployeeId,
                Excluded: true, Reason: "Left", round.Version),
            CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task Exclusion_of_a_round_in_another_tenant_answers_as_not_found()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"dark-exclude-tenant-{Guid.NewGuid()}";
        var scenario = await SeedLaunchedRoundAsync(tenantId, dbName);

        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out var tenant, dbName);
        var result = await new SetEvaluationRoundExclusionCommandHandler(db, Access, new ActivityLogWriter(db, tenant, new StubCurrentUserContext())).Handle(
            new SetEvaluationRoundExclusionCommand(
                Operator(), scenario.RoundId, scenario.Participants[0].EmployeeId,
                Excluded: true, Reason: "Left", 1),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Reassignment_is_denied_without_evaluation_operate_access()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"dark-reviewer-deny-{Guid.NewGuid()}";
        var scenario = await SeedLaunchedRoundAsync(tenantId, dbName);

        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var round = await db.EvaluationRounds.SingleAsync(item => item.Id == scenario.RoundId);

        var result = await new CorrectEvaluationRoundReviewerCommandHandler(db, Access, new ActivityLogWriter(db, tenant, new StubCurrentUserContext())).Handle(
            new CorrectEvaluationRoundReviewerCommand(
                Bystander(), scenario.RoundId, scenario.Participants[0].EmployeeId,
                Guid.NewGuid(), "New Reviewer", "Reorg", round.Version),
            CancellationToken.None);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task Reassignment_of_a_round_in_another_tenant_answers_as_not_found()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"dark-reviewer-tenant-{Guid.NewGuid()}";
        var scenario = await SeedLaunchedRoundAsync(tenantId, dbName);

        await using var db = PerformanceTestContext.Create(Guid.NewGuid(), out var tenant, dbName);
        var result = await new CorrectEvaluationRoundReviewerCommandHandler(db, Access, new ActivityLogWriter(db, tenant, new StubCurrentUserContext())).Handle(
            new CorrectEvaluationRoundReviewerCommand(
                Operator(), scenario.RoundId, scenario.Participants[0].EmployeeId,
                Guid.NewGuid(), "New Reviewer", "Reorg", 1),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task A_stale_version_is_rejected_rather_than_silently_overwriting()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"dark-stale-{Guid.NewGuid()}";
        var scenario = await SeedLaunchedRoundAsync(tenantId, dbName);

        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);

        // Someone else's change has already moved the round on.
        await Assert.ThrowsAnyAsync<Exception>(() =>
            new SetEvaluationRoundExclusionCommandHandler(db, Access, new ActivityLogWriter(db, tenant, new StubCurrentUserContext())).Handle(
                new SetEvaluationRoundExclusionCommand(
                    Operator(), scenario.RoundId, scenario.Participants[0].EmployeeId,
                    Excluded: true, Reason: "Left", ExpectedVersion: 999_999),
                CancellationToken.None));
    }

    [Fact]
    public async Task Exclusion_mid_round_removes_outstanding_work_and_records_activity()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"dark-exclude-live-{Guid.NewGuid()}";
        var scenario = await SeedLaunchedRoundAsync(tenantId, dbName);
        var participant = scenario.Participants[0];

        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var roundVersion = await db.EvaluationRounds.AsNoTracking()
            .Where(item => item.Id == scenario.RoundId).Select(item => item.Version).SingleAsync();
        var result = await new SetEvaluationRoundExclusionCommandHandler(
                db, Access, new ActivityLogWriter(db, tenant, new StubCurrentUserContext()))
            .Handle(new SetEvaluationRoundExclusionCommand(
                Operator(), scenario.RoundId, participant.EmployeeId, true, "Left the process", roundVersion),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Contains(result.Value.Exclusions, item => item.EmployeeId == participant.EmployeeId);
        Assert.Contains(await db.ActivityLogEntries.ToListAsync(), entry =>
            entry.Action == "EvaluationRoundParticipantExcluded" && entry.SubjectId == scenario.RoundId);

        var queue = await new GetTeamEvaluationAssignmentsQueryHandler(db, Access).Handle(
            new GetTeamEvaluationAssignmentsQuery(Reviewer(participant.ReviewerId)), CancellationToken.None);
        Assert.True(queue.IsSuccess);
        Assert.DoesNotContain(queue.Value, item => item.Assignment.ParticipantEmployeeId == participant.EmployeeId);
    }

    [Fact]
    public async Task Reassignment_moves_live_manager_work_preserves_status_and_records_activity()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"dark-reviewer-live-{Guid.NewGuid()}";
        var scenario = await SeedLaunchedRoundAsync(tenantId, dbName);
        var participant = scenario.Participants[0];
        var newReviewerId = Guid.NewGuid();

        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var roundVersion = await db.EvaluationRounds.AsNoTracking()
            .Where(item => item.Id == scenario.RoundId).Select(item => item.Version).SingleAsync();
        var before = await db.EvaluationAssignments.AsNoTracking().SingleAsync(item =>
            item.RoundId == scenario.RoundId && item.ParticipantEmployeeId == participant.EmployeeId
                && item.Kind == EvaluationAssignmentKind.ManagerAssessment);
        var result = await new CorrectEvaluationRoundReviewerCommandHandler(
                db, Access, new ActivityLogWriter(db, tenant, new StubCurrentUserContext()))
            .Handle(new CorrectEvaluationRoundReviewerCommand(
                Operator(), scenario.RoundId, participant.EmployeeId, newReviewerId, "New Reviewer", "Team change", roundVersion),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        var after = await db.EvaluationAssignments.AsNoTracking().SingleAsync(item => item.Id == before.Id);
        Assert.Equal(newReviewerId, after.AssigneeEmployeeId);
        Assert.Equal(before.Status, after.Status);
        Assert.Contains(await db.ActivityLogEntries.ToListAsync(), entry =>
            entry.Action == "EvaluationRoundReviewerReassigned" && entry.SubjectId == scenario.RoundId);

        var oldQueue = await new GetTeamEvaluationAssignmentsQueryHandler(db, Access).Handle(
            new GetTeamEvaluationAssignmentsQuery(Reviewer(participant.ReviewerId)), CancellationToken.None);
        var newQueue = await new GetTeamEvaluationAssignmentsQueryHandler(db, Access).Handle(
            new GetTeamEvaluationAssignmentsQuery(Reviewer(newReviewerId)), CancellationToken.None);
        Assert.True(oldQueue.IsSuccess);
        Assert.True(newQueue.IsSuccess);
        Assert.DoesNotContain(oldQueue.Value, item => item.Assignment.ParticipantEmployeeId == participant.EmployeeId);
        Assert.Contains(newQueue.Value, item => item.Assignment.ParticipantEmployeeId == participant.EmployeeId);
    }
}

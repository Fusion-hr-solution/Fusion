using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.Evaluations.Assessments.Commands;
using EY.HRPlatform.Performance.Features.Evaluations.Assessments.Dtos;
using EY.HRPlatform.Performance.Features.Evaluations.Assessments.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Evaluations;

/// <summary>
/// Contract fixes: version-guarded mutations (drafts included), structured incomplete-submission
/// blockers, self-version-guarded reopen, metadata-only pre-finalization visibility for
/// manager-only rounds, and paginated lists.
/// </summary>
public class EvaluationAssessmentContractTests
{
    private static readonly IPerformanceAccessPolicyService Access = new PerformanceAccessPolicyService();

    private static ClaimsPrincipal Employee(Guid employeeId) => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid()).WithEmployeeId(employeeId)
        .WithPermission(PerformancePermissions.EvaluationSelfView, PermissionScopes.Self).Build();

    private static ClaimsPrincipal Reviewer(Guid employeeId) => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid()).WithEmployeeId(employeeId)
        .WithPermission(PerformancePermissions.EvaluationTeamView, PermissionScopes.Tenant).Build();

    private static IActivityLog ActivityLog(PerformanceDbContext db, TenantContext tenant) =>
        new ActivityLogWriter(db, tenant, new StubCurrentUserContext());

    /// <summary>
    /// Seeds and launches in a throwaway context, so acting contexts load entities fresh from the
    /// store — adding response children to a pre-tracked aggregate trips EF InMemory otherwise.
    /// </summary>
    private static async Task<(Guid RoundId, Guid ParticipantId, Guid ReviewerId, Guid SelfId, Guid ManagerId)>
        LaunchAsync(Guid tenantId, string dbName, EvaluationTestScenario.Options? options = null)
    {
        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var scenario = await EvaluationTestScenario.SeedAndLaunchFreshAsync(
            db, tenantId, options ?? new(IncludeSkillsSection: true), CancellationToken.None);
        var assignments = await db.EvaluationAssignments.AsNoTracking()
            .Where(a => a.RoundId == scenario.RoundId).ToListAsync();
        var manager = assignments.First(a => a.Kind == EvaluationAssignmentKind.ManagerAssessment);
        var self = assignments.FirstOrDefault(a =>
            a.Kind == EvaluationAssignmentKind.SelfAssessment && a.ParticipantEmployeeId == manager.ParticipantEmployeeId);
        return (scenario.RoundId, manager.ParticipantEmployeeId, manager.AssigneeEmployeeId, self?.Id ?? Guid.Empty, manager.Id);
    }

    private static EvaluationAssessmentDraftInput CompleteDraft(AssessmentWorkspaceDto ws) => new(
        ws.Objectives.Select(o => new EvaluationObjectiveRatingInput(o.ObjectiveSnapshotId, 2, "Solid delivery.")).ToArray(),
        ws.Skills.Select(s => new EvaluationSkillRatingInput(s.SkillSnapshotItemId, 3, null)).ToArray(),
        ws.Questions.Select(q => new EvaluationQuestionAnswerInput(q.QuestionSnapshotId, "Went well.", null, false, null)).ToArray());

    // ─── Structured incomplete blockers ──────────────────────────────────────

    [Fact]
    public async Task SubmitSelf_Incomplete_ReturnsSpecificBlockers()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"contract-blockers-{Guid.NewGuid()}";
        var s = await LaunchAsync(tenantId, dbName);
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var actor = Employee(s.ParticipantId);

        // An empty draft moves the assignment to InProgress; the submit then fails on completeness.
        var self = await db.EvaluationAssignments.AsNoTracking().SingleAsync(a => a.Id == s.SelfId);
        var draft = await new SaveSelfDraftCommandHandler(db, Access)
            .Handle(new SaveSelfDraftCommand(actor, s.SelfId, EvaluationAssessmentDraftInput.Empty, self.Version),
                CancellationToken.None);
        Assert.True(draft.IsSuccess);

        var result = await new SubmitSelfCommandHandler(db, Access, ActivityLog(db, tenant))
            .Handle(new SubmitSelfCommand(actor, s.SelfId, draft.Value.Version), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Evaluations.IncompleteSubmission", result.Error.Code);
        var items = Assert.IsAssignableFrom<IReadOnlyList<AssessmentIncompleteItemDto>>(result.Error.Details);
        Assert.Contains(items, i => i.Section == "Objectives" && i.Label == "Improve delivery quality");
        Assert.Contains(items, i => i.Section == "Skills" && i.Label == "Software engineering");
        Assert.Contains(items, i => i.Section == "Questions" && i.Label == "What went well?");
    }

    // ─── Version-guarded drafts, submit, reopen ──────────────────────────────

    [Fact]
    public async Task SaveSelfDraft_WithStaleVersion_ThrowsConcurrency()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"contract-stale-{Guid.NewGuid()}";
        var s = await LaunchAsync(tenantId, dbName);
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);

        var handler = new SaveSelfDraftCommandHandler(db, Access);
        await Assert.ThrowsAsync<ConcurrencyException>(() => handler.Handle(
            new SaveSelfDraftCommand(Employee(s.ParticipantId), s.SelfId, EvaluationAssessmentDraftInput.Empty, 777),
            CancellationToken.None));
    }

    [Fact]
    public async Task SelfFlow_DraftSubmitReopen_ThreadsVersionsCorrectly()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"contract-flow-{Guid.NewGuid()}";
        var s = await LaunchAsync(tenantId, dbName);
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);
        var employee = Employee(s.ParticipantId);
        var reviewer = Reviewer(s.ReviewerId);

        var ws = (await new GetMyAssessmentWorkspaceQueryHandler(db, Access)
            .Handle(new GetMyAssessmentWorkspaceQuery(employee, s.RoundId), CancellationToken.None)).Value;
        Assert.True(ws.Editable);

        // Draft save carries If-Match and returns the (possibly advanced) version for the next call.
        var saved = await new SaveSelfDraftCommandHandler(db, Access)
            .Handle(new SaveSelfDraftCommand(employee, ws.AssignmentId, CompleteDraft(ws), ws.Version), CancellationToken.None);
        Assert.True(saved.IsSuccess);

        var submitted = await new SubmitSelfCommandHandler(db, Access, ActivityLog(db, tenant))
            .Handle(new SubmitSelfCommand(employee, ws.AssignmentId, saved.Value.Version), CancellationToken.None);
        Assert.True(submitted.IsSuccess);
        Assert.Equal("Submitted", submitted.Value.Status);
        Assert.False(submitted.Value.Editable);

        // A second submit against the now-submitted assignment is rejected, never double-applied.
        var again = await new SubmitSelfCommandHandler(db, Access, ActivityLog(db, tenant))
            .Handle(new SubmitSelfCommand(employee, ws.AssignmentId, submitted.Value.Version), CancellationToken.None);
        Assert.True(again.IsFailure);

        // Reopen is guarded by the SELF assignment version — a wrong token throws, the right one reopens.
        var selfVersion = (await db.EvaluationAssignments.AsNoTracking().SingleAsync(a => a.Id == s.SelfId)).Version;
        var reopenHandler = new ReopenSelfCommandHandler(db, Access, ActivityLog(db, tenant));
        await Assert.ThrowsAsync<ConcurrencyException>(() => reopenHandler.Handle(
            new ReopenSelfCommand(reviewer, s.SelfId, "Numbers need revisiting.", selfVersion + 5), CancellationToken.None));

        var reopened = await reopenHandler.Handle(
            new ReopenSelfCommand(reviewer, s.SelfId, "Numbers need revisiting.", selfVersion), CancellationToken.None);
        Assert.True(reopened.IsSuccess);
        var reopenedSelf = await db.EvaluationAssignments.AsNoTracking().SingleAsync(a => a.Id == s.SelfId);
        Assert.Equal(EvaluationAssignmentStatus.InProgress, reopenedSelf.Status);
    }

    [Fact]
    public async Task ParticipantWorkspace_ExposesManagerAndSelfVersionsSeparately()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"contract-versions-{Guid.NewGuid()}";
        var s = await LaunchAsync(tenantId, dbName);
        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);

        var result = await new GetParticipantAssessmentWorkspaceQueryHandler(db, Access)
            .Handle(new GetParticipantAssessmentWorkspaceQuery(Reviewer(s.ReviewerId), s.RoundId, s.ParticipantId),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value.SelfVersion);
    }

    // ─── Manager-only pre-finalization visibility ────────────────────────────

    [Fact]
    public async Task ManagerOnlyRound_BeforeFinalization_EmployeeGetsMetadataOnly()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"contract-awaiting-{Guid.NewGuid()}";
        var s = await LaunchAsync(tenantId, dbName, new(
            AssessmentModel: EvaluationAssessmentModel.ManagerOnly, IncludeSkillsSection: true));
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, dbName);

        // The reviewer records draft content — none of it may reach the employee before finalization.
        var managerWs = await new GetParticipantAssessmentWorkspaceQueryHandler(db, Access)
            .Handle(new GetParticipantAssessmentWorkspaceQuery(Reviewer(s.ReviewerId), s.RoundId, s.ParticipantId),
                CancellationToken.None);
        var draft = new EvaluationAssessmentDraftInput(
            managerWs.Value.Objectives.Select(o =>
                new EvaluationObjectiveRatingInput(o.ObjectiveSnapshotId, 1, "Confidential draft note.")).ToArray(),
            Array.Empty<EvaluationSkillRatingInput>(),
            Array.Empty<EvaluationQuestionAnswerInput>());
        var saved = await new SaveManagerDraftCommandHandler(db, Access)
            .Handle(new SaveManagerDraftCommand(Reviewer(s.ReviewerId), s.ManagerId, draft, managerWs.Value.ManagerVersion),
                CancellationToken.None);
        Assert.True(saved.IsSuccess);

        var employeeView = await new GetMyAssessmentWorkspaceQueryHandler(db, Access)
            .Handle(new GetMyAssessmentWorkspaceQuery(Employee(s.ParticipantId), s.RoundId), CancellationToken.None);

        Assert.True(employeeView.IsSuccess);
        var ws = employeeView.Value;
        Assert.Equal("AwaitingManager", ws.Status);
        Assert.False(ws.Editable);
        Assert.Empty(ws.Objectives);
        Assert.Empty(ws.Skills);
        Assert.Empty(ws.Questions);
        Assert.Empty(ws.PerformanceScale);
        Assert.Null(ws.Result);
        Assert.Null(ws.ManagerAssignmentId);
        Assert.Null(ws.ManagerAssignmentVersion);
    }

    // ─── Pagination ──────────────────────────────────────────────────────────

    [Fact]
    public async Task MyEvaluations_PagesAndCounts()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"contract-mine-page-{Guid.NewGuid()}";
        var s = await LaunchAsync(tenantId, dbName);
        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var handler = new GetMyEvaluationsQueryHandler(db, Access);

        var page1 = await handler.Handle(new GetMyEvaluationsQuery(Employee(s.ParticipantId), 1, 1), CancellationToken.None);
        Assert.True(page1.IsSuccess);
        Assert.Equal(1, page1.Value.TotalCount);
        Assert.Single(page1.Value.Items);

        var page2 = await handler.Handle(new GetMyEvaluationsQuery(Employee(s.ParticipantId), 2, 1), CancellationToken.None);
        Assert.True(page2.IsSuccess);
        Assert.Equal(1, page2.Value.TotalCount);
        Assert.Empty(page2.Value.Items);
    }

    [Fact]
    public async Task TeamQueue_PagesAndCounts()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"contract-team-page-{Guid.NewGuid()}";
        var s = await LaunchAsync(tenantId, dbName);
        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var handler = new GetTeamAssessmentQueueQueryHandler(db, Access);

        var page1 = await handler.Handle(
            new GetTeamAssessmentQueueQuery(Reviewer(s.ReviewerId), s.RoundId, 1, 1), CancellationToken.None);
        Assert.True(page1.IsSuccess);
        Assert.Equal(1, page1.Value.TotalCount);
        Assert.Single(page1.Value.Items);
        Assert.Equal(s.ParticipantId, page1.Value.Items[0].ParticipantEmployeeId);

        var beyond = await handler.Handle(
            new GetTeamAssessmentQueueQuery(Reviewer(s.ReviewerId), s.RoundId, 5, 50), CancellationToken.None);
        Assert.True(beyond.IsSuccess);
        Assert.Empty(beyond.Value.Items);
        Assert.Equal(1, beyond.Value.TotalCount);
    }
}

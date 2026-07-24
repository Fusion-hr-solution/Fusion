using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.Evaluations.Assessments.Commands;
using EY.HRPlatform.Performance.Features.Evaluations.Assessments.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Evaluations;

/// <summary>Task 7.5: assessment authorization, actionability, visibility, completion, and isolation.</summary>
public class EvaluationAssessmentFlowTests
{
    private static readonly IPerformanceAccessPolicyService Access = new PerformanceAccessPolicyService();

    private static ClaimsPrincipal Employee(Guid employeeId) => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid()).WithEmployeeId(employeeId)
        .WithPermission(PerformancePermissions.EvaluationSelfView, PermissionScopes.Self).Build();

    private static ClaimsPrincipal Reviewer(Guid employeeId) => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid()).WithEmployeeId(employeeId)
        .WithPermission(PerformancePermissions.EvaluationTeamView, PermissionScopes.Tenant).Build();

    private static ClaimsPrincipal Hr() => new ClaimsPrincipalBuilder()
        .WithUserId(Guid.NewGuid())
        .WithPermission(PerformancePermissions.EvaluationManage, PermissionScopes.Tenant).Build();

    private static IActivityLog ActivityLog(PerformanceDbContext db, TenantContext tenant) =>
        new ActivityLogWriter(db, tenant, new StubCurrentUserContext());

    private static async Task<(Guid RoundId, Guid ParticipantId, Guid ReviewerId, Guid SelfId, Guid ManagerId)>
        LaunchAsync(PerformanceDbContext db, Guid tenantId, string name)
    {
        var scenario = await EvaluationTestScenario.SeedAndLaunchFreshAsync(db, tenantId, new(IncludeSkillsSection: true), CancellationToken.None);
        var assignments = await db.EvaluationAssignments.AsNoTracking().Where(a => a.RoundId == scenario.RoundId).ToListAsync();
        var self = assignments.First(a => a.Kind == EvaluationAssignmentKind.SelfAssessment);
        var manager = assignments.First(a => a.Kind == EvaluationAssignmentKind.ManagerAssessment && a.ParticipantEmployeeId == self.ParticipantEmployeeId);
        return (scenario.RoundId, self.ParticipantEmployeeId, manager.AssigneeEmployeeId, self.Id, manager.Id);
    }

    [Fact]
    public async Task GetMyEvaluations_ListsParticipantRoundWithNextAction()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"assess-mine-{Guid.NewGuid()}");
        var s = await LaunchAsync(db, tenantId, "R");

        var handler = new GetMyEvaluationsQueryHandler(db, Access);
        var result = await handler.Handle(new GetMyEvaluationsQuery(Employee(s.ParticipantId)), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value.TotalCount);
        var item = Assert.Single(result.Value.Items);
        Assert.Equal(s.RoundId, item.RoundId);
        Assert.Equal("Start self-assessment", item.NextAction);
    }

    [Fact]
    public async Task MyWorkspace_ForSelfAssignee_ReturnsEditableAuthoringWorkspace()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"assess-workspace-{Guid.NewGuid()}");
        var s = await LaunchAsync(db, tenantId, "R");

        var handler = new GetMyAssessmentWorkspaceQueryHandler(db, Access);
        var result = await handler.Handle(new GetMyAssessmentWorkspaceQuery(Employee(s.ParticipantId), s.RoundId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.Editable);
        Assert.True(result.Value.IncludesObjectives);
        Assert.True(result.Value.IncludesSkills);
        Assert.NotEmpty(result.Value.Skills);
        Assert.Null(result.Value.Result);
    }

    [Fact]
    public async Task SaveSelfDraft_ByNonAssignee_IsForbidden()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, $"assess-forbidden-{Guid.NewGuid()}");
        var s = await LaunchAsync(db, tenantId, "R");

        var handler = new SaveSelfDraftCommandHandler(db, Access, ActivityLog(db, tenant));
        var result = await handler.Handle(
            new SaveSelfDraftCommand(Employee(Guid.NewGuid()), s.SelfId, EvaluationAssessmentDraftInput.Empty, 0),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code);
    }

    [Fact]
    public async Task SaveManagerDraft_BeforeActionable_ReturnsNotActionable()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenant, $"assess-notactionable-{Guid.NewGuid()}");
        var s = await LaunchAsync(db, tenantId, "R");

        // Self is NotStarted and the self deadline is in the future → manager not actionable yet.
        var handler = new SaveManagerDraftCommandHandler(db, Access, ActivityLog(db, tenant));
        var result = await handler.Handle(
            new SaveManagerDraftCommand(Reviewer(s.ReviewerId), s.ManagerId, EvaluationAssessmentDraftInput.Empty, 0),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotActionable", result.Error.Code);
    }

    [Fact]
    public async Task ParticipantWorkspace_EmployeePreFinalization_IsForbidden()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"assess-emp-preview-{Guid.NewGuid()}");
        var s = await LaunchAsync(db, tenantId, "R");

        var handler = new GetParticipantAssessmentWorkspaceQueryHandler(db, Access);
        var result = await handler.Handle(
            new GetParticipantAssessmentWorkspaceQuery(Employee(s.ParticipantId), s.RoundId, s.ParticipantId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code);
    }

    [Fact]
    public async Task ParticipantWorkspace_ReviewerBeforeSelfSubmit_HidesSelfContent()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"assess-reviewer-hidden-{Guid.NewGuid()}");
        var s = await LaunchAsync(db, tenantId, "R");

        var handler = new GetParticipantAssessmentWorkspaceQueryHandler(db, Access);
        var result = await handler.Handle(
            new GetParticipantAssessmentWorkspaceQuery(Reviewer(s.ReviewerId), s.RoundId, s.ParticipantId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.Actionable);
        Assert.All(result.Value.Objectives, o => Assert.Null(o.SelfRatingOrdinal));
        Assert.Null(result.Value.Result);
    }

    [Fact]
    public async Task RoundCompletion_ForHr_ReturnsCounts()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"assess-completion-{Guid.NewGuid()}");
        var s = await LaunchAsync(db, tenantId, "R");

        var handler = new GetRoundCompletionQueryHandler(db, Access);
        var result = await handler.Handle(new GetRoundCompletionQuery(Hr(), s.RoundId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.ParticipantCount >= 1);
        Assert.True(result.Value.SelfNotStarted >= 1);
        Assert.True(result.Value.ManagerNotStarted >= 1);
    }

    [Fact]
    public async Task CrossTenant_ParticipantWorkspace_IsNotFound()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var dbName = $"assess-isolation-{Guid.NewGuid()}";
        (Guid RoundId, Guid ParticipantId, Guid ReviewerId, Guid SelfId, Guid ManagerId) s;
        await using (var seed = PerformanceTestContext.Create(tenantA, out _, dbName))
            s = await LaunchAsync(seed, tenantA, "R");

        await using var db = PerformanceTestContext.Create(tenantB, out _, dbName);
        var handler = new GetParticipantAssessmentWorkspaceQueryHandler(db, Access);
        var result = await handler.Handle(
            new GetParticipantAssessmentWorkspaceQuery(Reviewer(s.ReviewerId), s.RoundId, s.ParticipantId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }
}

using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.CollectiveObjectives.Commands;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Features.Exceptions.Services;
using EY.HRPlatform.Performance.Features.Milestones.Commands;
using EY.HRPlatform.Performance.Features.Objectives.Commands;
using EY.HRPlatform.Performance.Features.Reviews.Commands;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Strategic.Commands;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Tests.Features.Cascade;

/// <summary>
/// D-18 keystone end-to-end integration test: drives the full three-level governed cascade
/// through real handlers in a single cohesive flow. Mirrors the Phase 2 D-03 keystone style
/// (GovernedHappyPathTests). One xUnit Fact exercises strategic publish → collective
/// routing/approval → individual approval → progress/milestones → formal review
/// finalize/lock, asserting observable outcomes at every governed step.
/// </summary>
public class ThreeLevelCascadeKeystoneTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    /// <summary>Fake access policy that grants all permissions — authorization is tested in dedicated handler tests.</summary>
    private sealed class AllowAllAccessPolicy : IPerformanceAccessPolicyService
    {
        public bool CanViewCycles(ClaimsPrincipal user) => true;
        public bool CanManageCycles(ClaimsPrincipal user) => true;
        public bool CanOperateCycles(ClaimsPrincipal user) => true;
        public bool CanViewObjectiveLibrary(ClaimsPrincipal user) => true;
        public bool CanManageObjectiveLibrary(ClaimsPrincipal user) => true;
        public bool CanViewStrategicObjectives(ClaimsPrincipal user) => true;
        public bool CanManageStrategicObjectives(ClaimsPrincipal user) => true;
        public bool CanPublishStrategicObjectives(ClaimsPrincipal user) => true;
        public bool CanViewCollectiveObjectives(ClaimsPrincipal user) => true;
        public bool CanApproveCollectiveObjectives(ClaimsPrincipal user) => true;
        public bool CanCorrectObjectiveProgress(ClaimsPrincipal user) => true;
        public bool CanAccessConfidentialFeedbackIdentity(ClaimsPrincipal user) => true;
        public bool CanViewFeedbackThresholdDetails(ClaimsPrincipal user) => true;
    }

    /// <summary>Simple ISender that dispatches RouteCollectiveApprovalCommand to the real handler.</summary>
    private sealed class TestMediator(RouteCollectiveApprovalCommandHandler routingHandler) : ISender
    {
        public async Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            if (request is RouteCollectiveApprovalCommand cmd)
            {
                var result = await routingHandler.Handle(cmd, cancellationToken);
                return (TResponse)(object)result!;
            }

            throw new NotSupportedException($"Unsupported MediatR request in test mediator: {request.GetType().Name}");
        }

        async Task ISender.Send<TRequest>(TRequest request, CancellationToken cancellationToken)
        {
            if (request is RouteCollectiveApprovalCommand cmd)
            {
                await routingHandler.Handle(cmd, cancellationToken);
                return;
            }

            throw new NotSupportedException($"Unsupported MediatR request in test mediator: {request?.GetType().Name}");
        }

        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    [Fact]
    public async Task FullThreeLevelCascade_PublishToFormalReviewFinalize()
    {
        // ══════════════════════════════════════════════════════════════════════
        // SETUP — actors, infrastructure, and campaign lifecycle
        // ══════════════════════════════════════════════════════════════════════

        var now = DateTime.UtcNow;
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);

        // Actors
        var employeeId = Guid.NewGuid();   // individual objective owner / subject
        var managerId = Guid.NewGuid();    // manager / collective approver / manager reviewer
        var directorId = Guid.NewGuid();   // director / primary-chain superior
        var exceptionOwnerId = Guid.NewGuid();

        // Current user context (used for audit stamps — the actor for most operations)
        var currentUser = new StubCurrentUserContext
        {
            EmployeeId = managerId,
            FullName = "Test Manager"
        };

        // Fake workforce client with manager chains and org-unit details
        var workforce = new FakeCoreWorkforceClient
        {
            ManagerChains =
            {
                // employeeId's chain: director → manager (root-first; chain[^1] is direct manager)
                [employeeId] =
                [
                    FakeCoreWorkforceClient.Employee(directorId, "Director"),
                    FakeCoreWorkforceClient.Employee(managerId, "Manager"),
                ],
                // managerId's chain: director (for routing if needed)
                [managerId] =
                [
                    FakeCoreWorkforceClient.Employee(directorId, "Director"),
                ],
            },
            OrgUnitDetails =
            {
                [Guid.Empty] = new CoreOrgUnitDetail(
                    Guid.Empty, "DEPT", "Engineering", "Department", null, managerId, true),
            }
        };
        // Populate the resolve pool for curate handler's ResolveEmployeesAsync calls
        workforce.ResolvePool =
        [
            FakeCoreWorkforceClient.Employee(employeeId, "Alice"),
            FakeCoreWorkforceClient.Employee(managerId, "Manager"),
            FakeCoreWorkforceClient.Employee(directorId, "Director"),
        ];

        // Access policy (all permissions granted — auth tested elsewhere)
        var accessPolicy = new AllowAllAccessPolicy();

        // HTTP context for handlers that read HttpContext.User
        var httpContext = new DefaultHttpContext();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };

        // ── Campaign lifecycle: Draft → configure → activate ──

        var cycle = PerformanceCycle.Create(
            TenantId, "FY26 Keystone", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(365));

        // Configure governance: frozen superior-approval rule REQUIRES approval (D-10)
        cycle.ConfigureGovernance(
            retentionPolicyVersionId: Guid.NewGuid(),
            requireTeamObjectiveSuperiorApproval: true,
            minimumAnonymousFeedbackResponses: 3,
            CampaignFeedbackVisibility.AnonymousToSubject,
            exceptionOwnerEmployeeIds: [exceptionOwnerId]);

        // Configure formal review definitions (must be done while Draft — IsEditable)
        var selfDefinitionInput = new ConfigureFormalReviewDefinitionCommand(
            cycle.Id, FormalReviewKind.Self, "Self Review",
            [new FormalReviewCriterionDefinitionInput("Goals", "Goal assessment", 1)],
            "Likert5",
            [new FormalRatingScaleLevelDefinitionInput(1, "Poor", null),
             new FormalRatingScaleLevelDefinitionInput(2, "Fair", null),
             new FormalRatingScaleLevelDefinitionInput(3, "Good", null),
             new FormalRatingScaleLevelDefinitionInput(4, "Very Good", null),
             new FormalRatingScaleLevelDefinitionInput(5, "Excellent", null)]);

        var managerDefinitionInput = new ConfigureFormalReviewDefinitionCommand(
            cycle.Id, FormalReviewKind.Manager, "Manager Review",
            [new FormalReviewCriterionDefinitionInput("Performance", "Performance assessment", 1)],
            "Likert5",
            [new FormalRatingScaleLevelDefinitionInput(1, "Poor", null),
             new FormalRatingScaleLevelDefinitionInput(2, "Fair", null),
             new FormalRatingScaleLevelDefinitionInput(3, "Good", null),
             new FormalRatingScaleLevelDefinitionInput(4, "Very Good", null),
             new FormalRatingScaleLevelDefinitionInput(5, "Excellent", null)]);

        // Set population — only employee and manager as participants (director is top of chain, not in cycle)
        cycle.SetPopulation(false,
        [
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.IncludeEmployee, employeeId, false),
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.IncludeEmployee, managerId, false),
        ]);

        // Seed into DB
        await using var db = PerformanceTestContext.Create(tenantContext);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();

        var cycleId = cycle.Id;
        var version = cycle.Version;

        // ── Configure formal review definitions via handler ──
        var configHandler = new ConfigureFormalReviewDefinitionCommandHandler(db, currentUser);
        var selfDefResult = await configHandler.Handle(selfDefinitionInput, CancellationToken.None);
        Assert.True(selfDefResult.IsSuccess);
        var selfDefinitionId = selfDefResult.Value;

        var mgrDefResult = await configHandler.Handle(managerDefinitionInput, CancellationToken.None);
        Assert.True(mgrDefResult.IsSuccess);

        // ── Activate cycle through full lifecycle ──

        // Step 1: Publish (Draft → AssignmentPreparation)
        var pubHandler = new PublishCycleCommandHandler(
            db, tenantContext, currentUser,
            new FakeResolver([
                FakeCoreWorkforceClient.Employee(employeeId, "Alice"),
                FakeCoreWorkforceClient.Employee(managerId, "Manager"),
            ]),
            workforce, Options.Create(new ReminderOptions()));
        var pubResult = await pubHandler.Handle(
            new PublishCycleCommand(cycleId, version), CancellationToken.None);
        Assert.True(pubResult.IsSuccess);
        version = pubResult.Value.Version;

        // Step 2: Curate responsibility for the employee
        var curateHandler = new CurateCampaignResponsibilityCommandHandler(
            db, tenantContext, currentUser, workforce);
        var curateResult = await curateHandler.Handle(new CurateCampaignResponsibilityCommand(
            cycleId, version, employeeId, managerId,
            CampaignResponsibilityDuty.ObjectiveApproval, "PrimaryManager", null),
            CancellationToken.None);
        Assert.True(curateResult.IsSuccess);
        version = curateResult.Value.CycleVersion;

        // Curate responsibility for the manager (approve by director)
        var curateResult2 = await curateHandler.Handle(new CurateCampaignResponsibilityCommand(
            cycleId, version, managerId, directorId,
            CampaignResponsibilityDuty.ObjectiveApproval, "PrimaryManager", null),
            CancellationToken.None);
        Assert.True(curateResult2.IsSuccess);
        version = curateResult2.Value.CycleVersion;

        // Step 3: MarkReadyToLaunch
        var rtlHandler = new MarkCycleReadyToLaunchCommandHandler(
            db, tenantContext, currentUser, workforce, Options.Create(new ReminderOptions()));
        var rtlResult = await rtlHandler.Handle(
            new MarkCycleReadyToLaunchCommand(cycleId, version, true), CancellationToken.None);
        Assert.True(rtlResult.IsSuccess);
        version = rtlResult.Value.Version;

        // Step 4: Activate
        var actHandler = new ActivateCycleCommandHandler(
            db, tenantContext, currentUser, Options.Create(new ReminderOptions()));
        var actResult = await actHandler.Handle(
            new ActivateCycleCommand(cycleId, version), CancellationToken.None);
        Assert.True(actResult.IsSuccess);

        // ══════════════════════════════════════════════════════════════════════
        // STEP 1: STRATEGIC — Create draft → Publish
        // ══════════════════════════════════════════════════════════════════════

        // Seed a StrategicPeriod
        var period = StrategicPeriod.Create(
            TenantId, "FY2026", 2026, PeriodGranularity.Annual,
            now.AddDays(-1), now.AddDays(365));
        db.StrategicPeriods.Add(period);
        await db.SaveChangesAsync();

        var strategicHandler = new CreateStrategicObjectiveCommandHandler(
            db, tenantContext, accessPolicy, httpContextAccessor);
        var strategicId = await strategicHandler.Handle(
            new CreateStrategicObjectiveCommand(period.Id, "Company", "Increase revenue", "Grow 20%"),
            CancellationToken.None);
        Assert.True(strategicId.IsSuccess);

        var strategicObj = await db.StrategicObjectives.SingleAsync(o => o.Id == strategicId.Value);
        Assert.Equal(StrategicObjectiveStatus.Draft, strategicObj.Status);

        // Publish
        var publishHandler = new PublishStrategicObjectiveCommandHandler(
            db, currentUser, accessPolicy, httpContextAccessor);
        var pubStrategicResult = await publishHandler.Handle(
            new PublishStrategicObjectiveCommand(strategicId.Value, strategicObj.Version),
            CancellationToken.None);
        Assert.True(pubStrategicResult.IsSuccess);

        // Reload and assert
        var publishedStrategic = await db.StrategicObjectives.SingleAsync(o => o.Id == strategicId.Value);
        Assert.Equal(StrategicObjectiveStatus.Published, publishedStrategic.Status);

        // Audit: StrategicObjectivePublished
        Assert.True(await db.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == strategicId.Value
                && a.Action == PerformanceCycleAuditAction.StrategicObjectivePublished));

        // ══════════════════════════════════════════════════════════════════════
        // STEP 2: COLLECTIVE — Create aligned to strategic → routing dispatches
        // ══════════════════════════════════════════════════════════════════════

        // Seed an org unit detail for the collective owner
        var orgUnitId = Guid.NewGuid();
        workforce.OrgUnitDetails[orgUnitId] = new CoreOrgUnitDetail(
            orgUnitId, "ENG", "Engineering Dept", "Department", null, managerId, true);

        // Create the routing handler (will be dispatched by CreateCollectiveObjective via TestMediator)
        var routingHandler = new RouteCollectiveApprovalCommandHandler(
            db,
            workforce,
            new ExceptionCaseWorkflowService(db, currentUser),
            currentUser);
        var mediator = new TestMediator(routingHandler);

        var collectiveHandler = new CreateCollectiveObjectiveCommandHandler(
            db, currentUser, accessPolicy, workforce, httpContextAccessor, mediator);
        var collectiveId = await collectiveHandler.Handle(
            new CreateCollectiveObjectiveCommand(
                cycleId, orgUnitId, strategicId.Value,
                "Engineering Revenue Growth", "Grow engineering revenue", 50m, null),
            CancellationToken.None);
        Assert.True(collectiveId.IsSuccess);

        // Assert: collective objective is Team-level, aligned to strategic parent
        var collectiveObj = await db.PerformanceObjectives.SingleAsync(o => o.Id == collectiveId.Value);
        Assert.Equal(ObjectiveLevel.Team, collectiveObj.Level);
        Assert.Equal(strategicId.Value, collectiveObj.ParentObjectiveId);

        // Assert: TeamObjectiveApproval work item materialized (routing ran under frozen rule)
        var routingWorkItem = await db.CampaignWorkItems
            .SingleOrDefaultAsync(w =>
                w.CycleId == cycleId &&
                w.Type == CampaignWorkItemType.TeamObjectiveApproval &&
                w.SubjectEmployeeId == managerId); // owner is the org-unit responsible manager
        Assert.NotNull(routingWorkItem);
        Assert.Equal(managerId, routingWorkItem.SubjectEmployeeId);

        // Audit: CollectiveObjectiveApprovalRouted
        Assert.True(await db.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == cycleId
                && a.Action == PerformanceCycleAuditAction.CollectiveObjectiveApprovalRouted));

        // ══════════════════════════════════════════════════════════════════════
        // STEP 3: COLLECTIVE SUBMIT + APPROVE — Submit from owner, approve from superior
        // ══════════════════════════════════════════════════════════════════════

        // Submit collective objective (owner is managerId — from org unit ResponsibleManagerEmployeeId)
        var submitCollectiveHandler = new SubmitObjectiveCommandHandler(db, currentUser);
        var submitCollectiveResult = await submitCollectiveHandler.Handle(
            new SubmitObjectiveCommand(collectiveId.Value), CancellationToken.None);
        Assert.True(submitCollectiveResult.IsSuccess);

        // The approver is the director (primary-chain superior of managerId)
        var collectiveApprover = new StubCurrentUserContext
        {
            EmployeeId = directorId,
            FullName = "Director"
        };

        var collectiveApprovalHandler = new DecideCollectiveObjectiveApprovalCommandHandler(
            db, collectiveApprover, accessPolicy, httpContextAccessor);
        var approveResult = await collectiveApprovalHandler.Handle(
            new DecideCollectiveObjectiveApprovalCommand(
                collectiveId.Value, routingWorkItem.Id, ObjectiveApprovalDecision.Approve),
            CancellationToken.None);
        Assert.True(approveResult.IsSuccess);

        // Reload and assert
        var approvedCollective = await db.PerformanceObjectives.SingleAsync(o => o.Id == collectiveId.Value);
        Assert.Equal(ObjectiveStatus.Approved, approvedCollective.Status);

        // ══════════════════════════════════════════════════════════════════════
        // STEP 4: INDIVIDUAL — Create → Submit → Approve
        // ══════════════════════════════════════════════════════════════════════

        // Seed an ObjectivePlanning work item for the employee
        var planningWorkItem = CampaignWorkItem.Create(
            TenantId, cycleId, employeeId, employeeId,
            CampaignWorkItemType.ObjectivePlanning,
            cycle.PeriodEnd);
        db.CampaignWorkItems.Add(planningWorkItem);
        await db.SaveChangesAsync();

        // Individual user context
        var individualUser = new StubCurrentUserContext
        {
            EmployeeId = employeeId,
            FullName = "Alice Employee"
        };

        // Create individual objective
        var createObjHandler = new CreateObjectiveCommandHandler(db, individualUser);
        var individualId = await createObjHandler.Handle(
            new CreateObjectiveCommand(
                cycleId, "My Revenue Target", "Contribute to revenue",
                "Revenue numbers", "Target 100k",
                cycle.PeriodEnd.AddDays(-10), 30m,
                ParentObjectiveId: strategicId.Value),
            CancellationToken.None);
        Assert.True(individualId.IsSuccess);

        var individualObj = await db.PerformanceObjectives.SingleAsync(o => o.Id == individualId.Value);
        Assert.Equal(ObjectiveLevel.Individual, individualObj.Level);
        Assert.Equal(strategicId.Value, individualObj.ParentObjectiveId);

        // Submit
        var submitHandler = new SubmitObjectiveCommandHandler(db, individualUser);
        var submitResult = await submitHandler.Handle(
            new SubmitObjectiveCommand(individualId.Value), CancellationToken.None);
        Assert.True(submitResult.IsSuccess);

        // Seed an ObjectiveApproval work item for the manager
        var approvalWorkItem = CampaignWorkItem.Create(
            TenantId, cycleId, employeeId, managerId,
            CampaignWorkItemType.ObjectiveApproval,
            cycle.PeriodEnd);
        db.CampaignWorkItems.Add(approvalWorkItem);
        await db.SaveChangesAsync();

        // Approve
        var decideHandler = new DecideObjectiveApprovalCommandHandler(db, currentUser);
        var approveObjResult = await decideHandler.Handle(
            new DecideObjectiveApprovalCommand(
                individualId.Value, approvalWorkItem.Id, ObjectiveApprovalDecision.Approve),
            CancellationToken.None);
        Assert.True(approveObjResult.IsSuccess);

        // Reload and assert
        var approvedIndividual = await db.PerformanceObjectives.SingleAsync(o => o.Id == individualId.Value);
        Assert.Equal(ObjectiveStatus.Approved, approvedIndividual.Status);

        // ══════════════════════════════════════════════════════════════════════
        // STEP 5: PROGRESS / MILESTONES — Add milestone + update progress
        // ══════════════════════════════════════════════════════════════════════

        var milestoneHandler = new AddMilestoneCommandHandler(db, individualUser);
        var milestoneResult = await milestoneHandler.Handle(
            new AddMilestoneCommand(individualId.Value, "Q1 Milestone", cycle.PeriodEnd.AddDays(-30)),
            CancellationToken.None);
        Assert.True(milestoneResult.IsSuccess);

        var progressHandler = new UpdateObjectiveProgressCommandHandler(db, individualUser);
        var progressResult = await progressHandler.Handle(
            new UpdateObjectiveProgressCommand(individualId.Value, 42m, "Q1 progress"),
            CancellationToken.None);
        Assert.True(progressResult.IsSuccess);

        // Assert: ObjectiveProgressEntry exists
        Assert.True(await db.ObjectiveProgressEntries
            .AnyAsync(e => e.ObjectiveId == individualId.Value && e.Source == "OwnerUpdate"));

        // Reload and assert progress on the objective
        var progressObj = await db.PerformanceObjectives.SingleAsync(o => o.Id == individualId.Value);
        Assert.Equal(42m, progressObj.ManualProgressPercent);

        // ══════════════════════════════════════════════════════════════════════
        // STEP 6: FORMAL REVIEW — Self → Manager → Finalize/Lock
        // ══════════════════════════════════════════════════════════════════════

        // Seed SelfReview + ManagerReview work items
        var selfReviewWorkItem = CampaignWorkItem.Create(
            TenantId, cycleId, employeeId, employeeId,
            CampaignWorkItemType.SelfReview,
            cycle.PeriodEnd);
        db.CampaignWorkItems.Add(selfReviewWorkItem);

        var managerReviewWorkItem = CampaignWorkItem.Create(
            TenantId, cycleId, employeeId, managerId,
            CampaignWorkItemType.ManagerReview,
            cycle.PeriodEnd);
        db.CampaignWorkItems.Add(managerReviewWorkItem);
        await db.SaveChangesAsync();

        // Load the self definition snapshot to get criterion IDs
        var selfDefinition = await db.FormalReviewDefinitionSnapshots
            .Include(d => d.Criteria)
            .SingleAsync(d => d.CycleId == cycleId && d.Kind == FormalReviewKind.Self);
        var selfCriterionId = selfDefinition.Criteria.First().Id;

        var managerDefinition = await db.FormalReviewDefinitionSnapshots
            .Include(d => d.Criteria)
            .SingleAsync(d => d.CycleId == cycleId && d.Kind == FormalReviewKind.Manager);
        var managerCriterionId = managerDefinition.Criteria.First().Id;

        // Submit self review
        var submitReviewHandler = new SubmitFormalReviewCommandHandler(db, individualUser);
        var selfReviewResult = await submitReviewHandler.Handle(
            new SubmitFormalReviewCommand(
                selfReviewWorkItem.Id,
                [new FormalReviewCriterionResponseInput(selfCriterionId, 4, "Good progress")],
                "I have been working hard", null),
            CancellationToken.None);
        Assert.True(selfReviewResult.IsSuccess);

        // Submit manager review (feeds from self review)
        var managerUser = new StubCurrentUserContext
        {
            EmployeeId = managerId,
            FullName = "Manager"
        };
        var submitMgrReviewHandler = new SubmitFormalReviewCommandHandler(db, managerUser);
        var mgrReviewResult = await submitMgrReviewHandler.Handle(
            new SubmitFormalReviewCommand(
                managerReviewWorkItem.Id,
                [new FormalReviewCriterionResponseInput(managerCriterionId, 4, "Strong performance")],
                "Alice has done great work", null),
            CancellationToken.None);
        Assert.True(mgrReviewResult.IsSuccess);

        // Finalize manager review → lock
        var finalizeHandler = new FinalizeManagerReviewCommandHandler(db, managerUser);
        var mgrReviewId = await db.PerformanceReviews
            .Where(r => r.WorkItemId == managerReviewWorkItem.Id)
            .Select(r => r.Id)
            .SingleAsync();
        var finalizeResult = await finalizeHandler.Handle(
            new FinalizeManagerReviewCommand(mgrReviewId), CancellationToken.None);
        Assert.True(finalizeResult.IsSuccess);

        // Assert: manager review IsLocked (Finalized)
        var finalizedReview = await db.PerformanceReviews.SingleAsync(r => r.Id == mgrReviewId);
        Assert.True(finalizedReview.IsLocked);
        Assert.Equal(FormalReviewStatus.Finalized, finalizedReview.Status);

        // Audit: ManagerReviewFinalized
        Assert.True(await db.PerformanceCycleAuditEvents
            .AnyAsync(a => a.CycleId == cycleId
                && a.Action == PerformanceCycleAuditAction.ManagerReviewFinalized));
    }

    /// <summary>No-op population resolver for cycle activation (keystone tests don't need real population resolution).</summary>
    private sealed class FakeResolver(IReadOnlyList<CoreEmployeeSummary> members) : IPerformancePopulationResolver
    {
        public Task<IReadOnlyList<CoreEmployeeSummary>> ResolveAsync(
            PerformanceCycle cycle, CancellationToken cancellationToken)
            => Task.FromResult(members);
    }
}

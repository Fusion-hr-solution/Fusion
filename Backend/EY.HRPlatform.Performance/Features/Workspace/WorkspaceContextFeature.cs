using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Features.Ai;
using EY.HRPlatform.Performance.Infrastructure.Ai;
using EY.HRPlatform.Performance.Features.Cycles;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Security.Policies;
using EY.HRPlatform.Performance.Features.Reviews;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Workspace;

/// <summary>The caller's token capabilities, resolved by the controller from the policy service.</summary>
public sealed record WorkspaceGrants(
    bool Administers,
    bool PublishesStrategy,
    bool ManagesOrgObjectives,
    bool Participates,
    bool CanCalibrate,
    string? AggregateViewScope);

public sealed record GetWorkspaceContextQuery(Guid? CycleId, WorkspaceGrants Grants) : IQuery<Result<WorkspaceContextDto>>;

/// <summary>
/// The selected Cycle, the Cycles the caller may switch to, and what the Performance workspace offers
/// them in that Cycle — composed from capabilities plus the responsibilities Performance recorded
/// (participation, responsible reviewer), never from a persona. Navigation follows this read; every
/// action is still authorized on its own.
/// </summary>
public sealed class GetWorkspaceContextHandler(PerformanceDbContext db, PerformanceViewer viewer, IPerformanceAiProvider ai)
    : IQueryHandler<GetWorkspaceContextQuery, Result<WorkspaceContextDto>>
{
    public async Task<Result<WorkspaceContextDto>> Handle(GetWorkspaceContextQuery request, CancellationToken cancellationToken)
    {
        var grants = request.Grants;
        var visibilityActor = new CycleVisibilityActor(viewer.EmployeeId ?? Guid.Empty, grants.Administers, grants.AggregateViewScope);
        var visible = await CyclePolicy.Visible(db.Cycles.AsNoTracking(), db.Participants.AsNoTracking(),
                db.PerformanceReviews.AsNoTracking(), visibilityActor)
            .OrderByDescending(cycle => cycle.State == CycleLifecycleState.Active)
            .ThenByDescending(cycle => cycle.StartDate)
            .ToListAsync(cancellationToken);

        PerformanceCycle? selected = null;
        if (request.CycleId is Guid requested)
        {
            selected = visible.FirstOrDefault(c => c.Id == requested);
            if (selected is null)
                return Result.Failure<WorkspaceContextDto>(PerformanceErrors.NotFound("Cycle", requested));
        }
        selected ??= visible
            .OrderByDescending(c => c.State == CycleLifecycleState.Active)
            .ThenByDescending(c => c.StartDate)
            .FirstOrDefault();

        var responsibilities = selected is null
            ? new CycleResponsibilities(false, [])
            : await viewer.ResponsibilitiesAsync(selected.Id, cancellationToken);
        var participates = grants.Participates && responsibilities.Participates;
        var canReviewReports = grants.AggregateViewScope is "DirectReports" or "OrgUnit" or "Tenant";
        var reviewer = canReviewReports && responsibilities.ReviewedEmployeeIds.Count > 0;
        var employeeId = viewer.EmployeeId ?? Guid.Empty;
        var hasReviewRelationship = selected is not null
            && await ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(),
                new ReviewActor(employeeId, grants.Administers, CanReviewReports: canReviewReports))
                .AnyAsync(review => review.CycleId == selected.Id, cancellationToken);
        var hasReviewWork = selected is not null && employeeId != Guid.Empty
            && await ReviewPolicy.Readable(db.PerformanceReviews.AsNoTracking(),
                new ReviewActor(employeeId, grants.Administers, CanReviewReports: canReviewReports))
                .AnyAsync(review => review.CycleId == selected.Id && review.ReviewerEmployeeId == employeeId, cancellationToken);
        // A calibrator has review work wherever a launched round of this Cycle uses calibration.
        var calibrates = selected is not null && grants.CanCalibrate && await db.ReviewRounds.AsNoTracking()
            .AnyAsync(round => round.CycleId == selected.Id && round.CalibrationEnabled
                && round.State != Domain.Reviews.ReviewRoundState.Draft, cancellationToken);
        // A colleague asked for peer input has review work too: their request lives in Reviews (D-18).
        var hasPeerRequest = selected is not null && employeeId != Guid.Empty && grants.Participates
            && await db.PeerRequests.AsNoTracking().AnyAsync(request => request.CycleId == selected.Id && request.PeerEmployeeId == employeeId, cancellationToken);
        var hasReviews = selected is not null && (grants.Administers || hasReviewRelationship || calibrates || hasPeerRequest);
        var orgRead = grants.AggregateViewScope is "DirectReports" or "OrgUnit" or "Tenant";

        var capabilities = new WorkspaceCapabilitiesDto(
            Participates: participates,
            IsResponsibleReviewer: reviewer,
            HasReviewWork: hasReviewWork,
            Administers: grants.Administers,
            PublishesStrategy: grants.PublishesStrategy,
            ManagesOrgObjectives: grants.ManagesOrgObjectives,
            CanCalibrate: grants.CanCalibrate,
            CanViewOrgDirection: grants.Administers || grants.PublishesStrategy || grants.ManagesOrgObjectives || orgRead,
            CanChooseOrganizationScope: grants.Administers || grants.AggregateViewScope == "Tenant",
            AiAssistance: await PerformanceAiAccess.IsAvailableAsync(db, ai, cancellationToken));

        var destinations = new WorkspaceDestinationsDto(
            Overview: true,
            MyPlan: participates,
            Team: reviewer,
            Reviews: hasReviews,
            CycleAdmin: grants.Administers,
            Settings: grants.Administers)
        {
            OneOnOnes = await HasOneOnOnesAsync(employeeId, cancellationToken),
            Feedback = true,
        };

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return new WorkspaceContextDto(
            visible.Select(PerformanceMappers.ToSummary).ToList(),
            selected is null ? null : PerformanceMappers.ToSummary(selected),
            selected is null ? null : CycleDetailComposer.PhaseOf(selected, today),
            capabilities,
            destinations);
    }

    /// <summary>
    /// 1:1s follow people, not cycles: anyone with a current manager or direct reports in Core HR, or any series. With Core
    /// HR down, a series alone decides; navigation never grants access.
    /// </summary>
    private async Task<bool> HasOneOnOnesAsync(Guid employeeId, CancellationToken cancellationToken)
    {
        if (employeeId == Guid.Empty) return false;
        if (await db.OneOnOneSeries.AsNoTracking().AnyAsync(s => s.ManagerEmployeeId == employeeId || s.ReportEmployeeId == employeeId, cancellationToken))
            return true;
        try
        {
            var line = await viewer.CurrentLineAsync(cancellationToken);
            return line.ManagerEmployeeId is not null || line.DirectReports.Count > 0;
        }
        catch (HttpRequestException) { return false; }
    }

}

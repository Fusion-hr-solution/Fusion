using EY.HRPlatform.Performance.Features.PlanningCompletion.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.PlanningCompletion.Queries;

public sealed record GetPlanningCompletionWorkspaceQuery(
    string Slug,
    string? Status,
    string? Blocker,
    bool? Overdue,
    bool? ReminderNeeded,
    Guid? ApproverEmployeeId,
    string? Search,
    int Page,
    int PageSize) : IQuery<Result<PlanningCompletionWorkspaceDto>>;

public sealed class GetPlanningCompletionWorkspaceQueryHandler(
    PlanningCompletionReadService readService)
    : IQueryHandler<GetPlanningCompletionWorkspaceQuery, Result<PlanningCompletionWorkspaceDto>>
{
    public Task<Result<PlanningCompletionWorkspaceDto>> Handle(
        GetPlanningCompletionWorkspaceQuery request,
        CancellationToken cancellationToken)
        => readService.GetWorkspaceAsync(
            request.Slug,
            request.Status,
            request.Blocker,
            request.Overdue,
            request.ReminderNeeded,
            request.ApproverEmployeeId,
            request.Search,
            request.Page,
            request.PageSize,
            cancellationToken);
}

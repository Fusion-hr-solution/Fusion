using EY.HRPlatform.Performance.Features.PlanningCompletion.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.PlanningCompletion.Queries;

public sealed record GetPlanningCompletionParticipantDetailQuery(
    Guid CycleId,
    Guid ParticipantEmployeeId) : IQuery<Result<PlanningCompletionParticipantDetailDto>>;

public sealed class GetPlanningCompletionParticipantDetailQueryHandler(
    PlanningCompletionReadService readService)
    : IQueryHandler<GetPlanningCompletionParticipantDetailQuery, Result<PlanningCompletionParticipantDetailDto>>
{
    public Task<Result<PlanningCompletionParticipantDetailDto>> Handle(
        GetPlanningCompletionParticipantDetailQuery request,
        CancellationToken cancellationToken)
        => readService.GetParticipantDetailAsync(request.CycleId, request.ParticipantEmployeeId, cancellationToken);
}

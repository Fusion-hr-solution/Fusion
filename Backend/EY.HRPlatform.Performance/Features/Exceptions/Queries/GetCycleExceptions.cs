using EY.HRPlatform.Performance.Features.Exceptions.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Exceptions.Queries;

public sealed record GetCycleExceptionsQuery(Guid CycleId) : IQuery<Result<IReadOnlyList<ExceptionCaseDto>>>;

public sealed class GetCycleExceptionsQueryHandler(PerformanceDbContext dbContext)
    : IQueryHandler<GetCycleExceptionsQuery, Result<IReadOnlyList<ExceptionCaseDto>>>
{
    public async Task<Result<IReadOnlyList<ExceptionCaseDto>>> Handle(GetCycleExceptionsQuery request, CancellationToken cancellationToken)
    {
        var cycleExists = await dbContext.PerformanceCycles.AnyAsync(item => item.Id == request.CycleId, cancellationToken);
        if (!cycleExists)
            return Result.Failure<IReadOnlyList<ExceptionCaseDto>>(Error.NotFound("PerformanceCycle", request.CycleId));

        var items = await dbContext.ExceptionCases
            .AsNoTracking()
            .Where(item => item.CycleId == request.CycleId)
            .OrderByDescending(item => item.OpenedAt)
            .Select(item => new ExceptionCaseDto(
                item.Id,
                item.CycleId,
                item.SourceWorkItemId,
                item.SourceWorkItemType.ToString(),
                item.SourceObjectId,
                item.CurrentOwnerEmployeeId,
                item.Status.ToString(),
                item.FrozenReason,
                item.FailureCode,
                item.OpenedAt,
                item.ResolvedAt,
                item.CurrentResolutionWorkItemId,
                item.PreviousCaseId,
                item.ResolutionAction != null ? item.ResolutionAction.ToString() : null))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<ExceptionCaseDto>>(items);
    }
}

using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

public sealed record DeleteCycleCommand(Guid CycleId, uint ExpectedVersion) : ICommand<Result>;

public sealed class DeleteCycleCommandHandler(
    PerformanceDbContext dbContext) : ICommandHandler<DeleteCycleCommand, Result>
{
    public async Task<Result> Handle(DeleteCycleCommand request, CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        if (cycle.Status != PerformanceCycleStatus.Draft)
        {
            return Result.Failure(Error.Conflict(
                "Cycle.NotDraft", "Only a draft cycle can be deleted. Close the cycle instead."));
        }

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);
        dbContext.PerformanceCycles.Remove(cycle);

        // Audit events are append-only and intentionally retained after a draft is removed.
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(PerformanceCycle), cycle.Id);
        }

        return Result.Success();
    }
}

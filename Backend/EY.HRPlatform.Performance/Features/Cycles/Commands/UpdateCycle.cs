using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

public sealed record UpdateCycleCommand(
    Guid CycleId,
    uint ExpectedVersion,
    string Name,
    string? Purpose,
    int ReferenceYear,
    DateTime PlanningOpeningDate,
    DateTime EmployeeSubmissionDeadline,
    DateTime ManagerApprovalDeadline,
    DateTime ExpectedPlanningLockDate) : ICommand<Result<PerformanceCycleDetailDto>>;

public sealed class UpdateCycleCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    IOptions<ReminderOptions> reminderOptions) : ICommandHandler<UpdateCycleCommand, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(
        UpdateCycleCommand request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .Include(c => c.PopulationRules)
            .Include(c => c.StrategicObjectives)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure<PerformanceCycleDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var normalizedName = request.Name.Trim();
        var nameTaken = await dbContext.PerformanceCycles
            .AnyAsync(c => c.Id != cycle.Id && c.Name.ToLower() == normalizedName.ToLower(), cancellationToken);
        if (nameTaken)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Conflict("Cycle.DuplicateName", $"A performance cycle named '{normalizedName}' already exists."));
        }

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);

        try
        {
            cycle.UpdateDraftDetails(
                request.Name,
                request.ReferenceYear,
                request.Purpose,
                request.PlanningOpeningDate,
                request.EmployeeSubmissionDeadline,
                request.ManagerApprovalDeadline,
                request.ExpectedPlanningLockDate);
        }
        catch (ArgumentException exception)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Validation("Campaign.InvalidDraft", exception.Message));
        }

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId,
            cycle.Id,
            PerformanceCycleAuditAction.Updated,
            currentUser.UserId,
            currentUser.FullName,
            "Updated campaign identity or planning schedule."));

        await SaveWithConcurrencyAsync(cycle.Id, cancellationToken);

        var participantCount = await dbContext.PerformanceCycleParticipants
            .CountAsync(p => p.CycleId == cycle.Id, cancellationToken);
        return CycleMapper.ToDetail(cycle, participantCount, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }

    private async Task SaveWithConcurrencyAsync(Guid cycleId, CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(PerformanceCycle), cycleId);
        }
    }
}

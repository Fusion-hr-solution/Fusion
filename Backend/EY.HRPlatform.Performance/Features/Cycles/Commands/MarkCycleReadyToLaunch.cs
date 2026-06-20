using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Entities;
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

public sealed record MarkCycleReadyToLaunchCommand(Guid CycleId, uint ExpectedVersion, bool AcceptCurrentWorkforceDelta)
    : ICommand<Result<PerformanceCycleDetailDto>>;

public sealed class MarkCycleReadyToLaunchCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    IOptions<ReminderOptions> reminderOptions)
    : ICommandHandler<MarkCycleReadyToLaunchCommand, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(MarkCycleReadyToLaunchCommand request, CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles.Include(x => x.Participants)
            .SingleOrDefaultAsync(x => x.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PerformanceCycleDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        if (cycle.Status != PerformanceCycleStatus.AssignmentPreparation)
            return Result.Failure<PerformanceCycleDetailDto>(Error.Conflict("Cycle.NotInPreparation", "Only a campaign in assignment preparation can be marked ready."));

        var responsibilityRows = await dbContext.CampaignAssignmentResponsibilities
            .Where(x => x.CycleId == cycle.Id && x.Duty == CampaignResponsibilityDuty.ObjectiveApproval)
            .ToListAsync(cancellationToken);
        var coveredSubjects = responsibilityRows
            .GroupBy(x => x.SubjectEmployeeId)
            .Where(group => group.OrderByDescending(x => x.Revision).First().IsFinal)
            .Select(group => group.Key)
            .ToHashSet();
        var failures = cycle.Participants.Count(x => !coveredSubjects.Contains(x.EmployeeId));

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);
        try
        {
            cycle.MarkReadyToLaunch(coveredSubjects.Count, failures, request.AcceptCurrentWorkforceDelta, DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is ArgumentException or DomainRuleViolationException)
        {
            return Result.Failure<PerformanceCycleDetailDto>(Error.Conflict("Cycle.NotReady", exception.Message));
        }

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId, cycle.Id, PerformanceCycleAuditAction.ReadyToLaunch,
            currentUser.UserId, currentUser.FullName, "Final responsibilities and current workforce delta accepted."));
        await dbContext.SaveChangesAsync(cancellationToken);
        return CycleMapper.ToDetail(cycle, cycle.Participants.Count, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }
}

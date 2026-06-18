using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

public sealed record PublishCycleCommand(Guid CycleId, uint ExpectedVersion) : ICommand<Result<PerformanceCycleDetailDto>>;

public sealed class PublishCycleCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    IPerformancePopulationResolver populationResolver,
    IOptions<ReminderOptions> reminderOptions) : ICommandHandler<PublishCycleCommand, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(
        PublishCycleCommand request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .Include(c => c.PopulationRules)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure<PerformanceCycleDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        if (cycle.Status != PerformanceCycleStatus.Draft)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Conflict("Cycle.NotDraft", "Only a draft cycle can be published."));
        }

        var members = await populationResolver.ResolveAsync(cycle, cancellationToken);
        if (members.Count == 0)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Conflict("Cycle.EmptyPopulation", "The cycle population resolves to no employees. Adjust the population before publishing."));
        }

        var tenantId = tenantContext.TenantId;
        var participants = members
            .Select(member => PerformanceCycleParticipant.Create(
                tenantId,
                cycle.Id,
                member.EmployeeId,
                string.IsNullOrWhiteSpace(member.DisplayName) ? member.FullName : member.DisplayName,
                member.StableEmployeeKey,
                member.WorkEmail,
                member.OrgUnit?.OrgUnitId,
                member.OrgUnit?.Name,
                member.JobTitle,
                member.Manager?.EmployeeId,
                member.Manager?.DisplayName))
            .ToList();

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);

        cycle.Publish(participants.Count);

        // The participant snapshot is written as explicit child rows in the same transaction.
        dbContext.PerformanceCycleParticipants.AddRange(participants);

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantId,
            cycle.Id,
            PerformanceCycleAuditAction.Published,
            currentUser.UserId,
            currentUser.FullName,
            $"Snapshotted {participants.Count} participant(s)."));

        dbContext.PerformanceNotifications.AddRange(
            CycleNotificationFactory.ForLifecycle(
                cycle,
                PerformanceNotificationType.CyclePublished,
                participants.Select(p => p.EmployeeId)));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(PerformanceCycle), cycle.Id);
        }

        return CycleMapper.ToDetail(cycle, participants.Count, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }
}

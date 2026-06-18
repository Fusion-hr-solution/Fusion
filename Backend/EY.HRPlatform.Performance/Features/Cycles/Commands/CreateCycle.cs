using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
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

public sealed record CreateCycleCommand(
    string Name,
    string? Description,
    PerformanceCycleType Type,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    DateTime? ObjectiveSettingDeadline,
    bool PopulationIncludeInactive) : ICommand<Result<PerformanceCycleDetailDto>>;

public sealed class CreateCycleCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    IOptions<ReminderOptions> reminderOptions) : ICommandHandler<CreateCycleCommand, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(
        CreateCycleCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantContext.TenantId;
        var normalizedName = request.Name.Trim();

        var nameTaken = await dbContext.PerformanceCycles
            .AnyAsync(c => c.Name.ToLower() == normalizedName.ToLower(), cancellationToken);
        if (nameTaken)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Conflict("Cycle.DuplicateName", $"A performance cycle named '{normalizedName}' already exists."));
        }

        var cycle = PerformanceCycle.Create(
            tenantId,
            request.Name,
            request.Type,
            request.PeriodStart,
            request.PeriodEnd,
            request.ObjectiveSettingDeadline,
            request.PopulationIncludeInactive,
            request.Description);

        dbContext.PerformanceCycles.Add(cycle);
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantId, cycle.Id, PerformanceCycleAuditAction.Created, currentUser.UserId, currentUser.FullName));

        await dbContext.SaveChangesAsync(cancellationToken);

        return CycleMapper.ToDetail(cycle, 0, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }
}

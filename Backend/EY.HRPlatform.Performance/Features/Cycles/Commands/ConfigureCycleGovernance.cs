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

public sealed record ConfigureCycleGovernanceCommand(
    Guid CycleId,
    uint ExpectedVersion,
    Guid RetentionPolicyVersionId,
    bool RequireTeamObjectiveSuperiorApproval,
    int MinimumAnonymousFeedbackResponses,
    CampaignFeedbackVisibility FeedbackVisibility,
    IReadOnlyList<Guid> ExceptionOwnerEmployeeIds) : ICommand<Result<PerformanceCycleDetailDto>>;

public sealed class ConfigureCycleGovernanceCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    IOptions<ReminderOptions> reminderOptions)
    : ICommandHandler<ConfigureCycleGovernanceCommand, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(
        ConfigureCycleGovernanceCommand request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .Include(x => x.PopulationRules)
            .Include(x => x.ExceptionOwners)
            .SingleOrDefaultAsync(x => x.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<PerformanceCycleDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);
        try
        {
            cycle.ConfigureGovernance(
                request.RetentionPolicyVersionId,
                request.RequireTeamObjectiveSuperiorApproval,
                request.MinimumAnonymousFeedbackResponses,
                request.FeedbackVisibility,
                request.ExceptionOwnerEmployeeIds);
        }
        catch (ArgumentException exception)
        {
            return Result.Failure<PerformanceCycleDetailDto>(Error.Validation("Cycle.InvalidGovernance", exception.Message));
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure<PerformanceCycleDetailDto>(Error.Conflict("Cycle.GovernanceLocked", exception.Message));
        }

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId, cycle.Id, PerformanceCycleAuditAction.GovernanceConfigured,
            currentUser.UserId, currentUser.FullName,
            "Campaign governance configuration was updated."));
        await dbContext.SaveChangesAsync(cancellationToken);
        return CycleMapper.ToDetail(cycle, 0, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }
}

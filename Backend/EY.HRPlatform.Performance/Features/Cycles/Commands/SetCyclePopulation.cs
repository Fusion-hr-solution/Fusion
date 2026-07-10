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

public sealed record SetCyclePopulationCommand(
    Guid CycleId,
    uint ExpectedVersion,
    bool PopulationIncludeInactive,
    IReadOnlyList<PopulationRuleInput> Rules) : ICommand<Result<PerformanceCycleDetailDto>>;

public sealed class SetCyclePopulationCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    IOptions<ReminderOptions> reminderOptions) : ICommandHandler<SetCyclePopulationCommand, Result<PerformanceCycleDetailDto>>
{
    public async Task<Result<PerformanceCycleDetailDto>> Handle(
        SetCyclePopulationCommand request,
        CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .Include(c => c.PopulationRules)
            .FirstOrDefaultAsync(c => c.Id == request.CycleId, cancellationToken);

        if (cycle is null)
        {
            return Result.Failure<PerformanceCycleDetailDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        }

        var tenantId = tenantContext.TenantId;
        var rules = new List<PerformanceCyclePopulationRule>();
        var ruleKeys = new HashSet<(PopulationRuleType RuleType, Guid RefId)>();
        var includedEmployeeIds = new HashSet<Guid>();
        var excludedEmployeeIds = new HashSet<Guid>();
        foreach (var input in request.Rules)
        {
            if (!Enum.TryParse<PopulationRuleType>(input.RuleType, ignoreCase: true, out var ruleType))
            {
                return Result.Failure<PerformanceCycleDetailDto>(
                    Error.Validation("Cycle.InvalidRuleType", $"Unknown population rule type '{input.RuleType}'."));
            }

            if (input.RefId == Guid.Empty)
            {
                return Result.Failure<PerformanceCycleDetailDto>(
                    Error.Validation("Cycle.InvalidRuleRef", "Population rule reference id cannot be empty."));
            }

            if (!ruleKeys.Add((ruleType, input.RefId)))
            {
                return Result.Failure<PerformanceCycleDetailDto>(
                    Error.Validation("Cycle.DuplicatePopulationRule", "Each population rule can only be configured once."));
            }

            if (ruleType == PopulationRuleType.ExcludeEmployee && string.IsNullOrWhiteSpace(input.Reason))
            {
                return Result.Failure<PerformanceCycleDetailDto>(
                    Error.Validation("Cycle.ExclusionReasonRequired", "Each excluded employee requires a reason."));
            }

            if (ruleType == PopulationRuleType.IncludeEmployee)
            {
                includedEmployeeIds.Add(input.RefId);
            }
            else if (ruleType == PopulationRuleType.ExcludeEmployee)
            {
                excludedEmployeeIds.Add(input.RefId);
            }

            rules.Add(PerformanceCyclePopulationRule.Create(tenantId, ruleType, input.RefId, input.IncludeDescendants, input.Reason));
        }

        // An empty scope set is the implicit all-active baseline; exclusions may still apply.
        if (includedEmployeeIds.Overlaps(excludedEmployeeIds))
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Validation("Cycle.ConflictingPopulationRule", "An employee cannot be both explicitly included and excluded."));
        }

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);

        cycle.SetPopulation(request.PopulationIncludeInactive, rules);
        // Track new rules explicitly (not only via the aggregate navigation): eager Added tracking
        // produces correct child-insert/parent-update ordering and avoids a false xmin concurrency
        // conflict on the versioned parent row.
        dbContext.PerformanceCyclePopulationRules.AddRange(rules);

        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantId,
            cycle.Id,
            PerformanceCycleAuditAction.PopulationUpdated,
            currentUser.UserId,
            currentUser.FullName,
            $"{rules.Count} rule(s)"));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(PerformanceCycle), cycle.Id);
        }

        return CycleMapper.ToDetail(cycle, 0, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }
}

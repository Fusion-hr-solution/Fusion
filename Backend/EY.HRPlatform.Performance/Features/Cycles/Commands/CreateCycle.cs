using EY.HRPlatform.Performance.Domain;
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
    string? Purpose,
    int ReferenceYear,
    DateTime PlanningOpeningDate,
    DateTime EmployeeSubmissionDeadline,
    DateTime ManagerApprovalDeadline,
    DateTime ExpectedPlanningLockDate) : ICommand<Result<PerformanceCycleDetailDto>>;

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

        if (currentUser.UserId is null)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Validation("Campaign.OwnerRequired", "The campaign owner could not be resolved from the current user."));
        }

        var currentPlanningRules = await dbContext.TenantObjectivePolicyVersions
            .Where(version => version.Status == ObjectivePlanningConfigurationVersionStatus.Current)
            .SingleOrDefaultAsync(cancellationToken);

        if (currentPlanningRules is null)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Validation("Campaign.PlanningRulesMissing", "Objective planning rules must be configured before creating a campaign."));
        }

        var snapshot = CampaignPlanningRulesSnapshot.Capture(
            currentPlanningRules.MaxObjectivesPerPlan,
            currentPlanningRules.AllowedWeightValues,
            currentPlanningRules.MeasurementTypes,
            currentPlanningRules.Id,
            DateTime.UtcNow);

        var baseSlug = CampaignSlug.From(normalizedName, request.ReferenceYear);
        var conflictingSlugs = await dbContext.PerformanceCycles
            .Where(c => c.Slug == baseSlug || c.Slug.StartsWith(baseSlug + "-"))
            .Select(c => c.Slug)
            .ToListAsync(cancellationToken);
        var slug = CampaignSlug.Unique(baseSlug, conflictingSlugs);

        PerformanceCycle cycle;
        try
        {
            cycle = PerformanceCycle.CreateDraft(
                tenantId,
                request.Name,
                slug,
                request.ReferenceYear,
                request.Purpose,
                currentUser.UserId.Value,
                currentUser.FullName,
                request.PlanningOpeningDate,
                request.EmployeeSubmissionDeadline,
                request.ManagerApprovalDeadline,
                request.ExpectedPlanningLockDate,
                snapshot);
        }
        catch (ArgumentException exception)
        {
            return Result.Failure<PerformanceCycleDetailDto>(
                Error.Validation("Campaign.InvalidDraft", exception.Message));
        }

        dbContext.PerformanceCycles.Add(cycle);
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantId,
            cycle.Id,
            PerformanceCycleAuditAction.Created,
            currentUser.UserId,
            currentUser.FullName,
            $"Created campaign '{cycle.Name}' for {cycle.ReferenceYear}."));
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantId,
            cycle.Id,
            PerformanceCycleAuditAction.PlanningRulesSnapshotCaptured,
            currentUser.UserId,
            currentUser.FullName,
            $"Captured objective planning rules version {currentPlanningRules.Id}."));

        await dbContext.SaveChangesAsync(cancellationToken);

        return CycleMapper.ToDetail(cycle, 0, reminderOptions.Value.DueSoonWindowDays, DateTime.UtcNow);
    }
}

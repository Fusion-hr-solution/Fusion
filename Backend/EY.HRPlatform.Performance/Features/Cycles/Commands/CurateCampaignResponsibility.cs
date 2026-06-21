using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Cycles.Commands;

public sealed record CurateCampaignResponsibilityCommand(
    Guid CycleId, uint ExpectedVersion, Guid SubjectEmployeeId, Guid AssigneeEmployeeId,
    CampaignResponsibilityDuty Duty, string RelationshipSource, string? OverrideReason)
    : ICommand<Result<CuratedCampaignResponsibilityDto>>;

public sealed class CurateCampaignResponsibilityCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser,
    ICoreWorkforceClient workforceClient) : ICommandHandler<CurateCampaignResponsibilityCommand, Result<CuratedCampaignResponsibilityDto>>
{
    public async Task<Result<CuratedCampaignResponsibilityDto>> Handle(CurateCampaignResponsibilityCommand request, CancellationToken cancellationToken)
    {
        var cycle = await dbContext.PerformanceCycles
            .Include(x => x.Participants)
            .SingleOrDefaultAsync(x => x.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<CuratedCampaignResponsibilityDto>(Error.NotFound("PerformanceCycle", request.CycleId));
        if (cycle.Status != PerformanceCycleStatus.AssignmentPreparation)
            return Result.Failure<CuratedCampaignResponsibilityDto>(Error.Conflict("Cycle.NotInPreparation", "Responsibilities can only be curated during assignment preparation."));
        if (!cycle.Participants.Any(x => x.EmployeeId == request.SubjectEmployeeId))
            return Result.Failure<CuratedCampaignResponsibilityDto>(Error.Validation("Cycle.UnknownSubject", "The responsibility subject is not in this campaign population."));

        var currentWorkforce = await workforceClient.ResolveEmployeesAsync(
            [request.SubjectEmployeeId, request.AssigneeEmployeeId], cancellationToken);
        var subject = currentWorkforce.SingleOrDefault(x => x.EmployeeId == request.SubjectEmployeeId && x.IsActive);
        if (subject is null)
            return Result.Failure<CuratedCampaignResponsibilityDto>(Error.Validation("Cycle.IneligibleSubject", "The responsibility subject is inactive or outside the current workforce scope."));

        var assignee = currentWorkforce.SingleOrDefault(x => x.EmployeeId == request.AssigneeEmployeeId && x.IsActive);
        if (assignee is null)
            return Result.Failure<CuratedCampaignResponsibilityDto>(Error.Validation("Cycle.IneligibleAssignee", "The selected assignee is inactive or outside the current workforce scope."));

        ConcurrencyGuard.Ensure(cycle.Version, request.ExpectedVersion, nameof(PerformanceCycle), cycle.Id);
        var latestRevision = await dbContext.CampaignAssignmentResponsibilities
            .Where(x => x.CycleId == request.CycleId && x.SubjectEmployeeId == request.SubjectEmployeeId && x.Duty == request.Duty)
            .MaxAsync(x => (int?)x.Revision, cancellationToken) ?? 0;

        CampaignAssignmentResponsibility responsibility;
        try
        {
            responsibility = CampaignAssignmentResponsibility.Confirm(
                tenantContext.TenantId, cycle.Id, request.SubjectEmployeeId, request.AssigneeEmployeeId,
                string.IsNullOrWhiteSpace(assignee.DisplayName) ? assignee.FullName : assignee.DisplayName,
                request.Duty, CampaignAssignmentSource.Curated, request.RelationshipSource,
                request.OverrideReason, latestRevision + 1);
        }
        catch (ArgumentException exception)
        {
            return Result.Failure<CuratedCampaignResponsibilityDto>(Error.Validation("Cycle.InvalidResponsibility", exception.Message));
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure<CuratedCampaignResponsibilityDto>(Error.Validation("Cycle.InvalidResponsibility", exception.Message));
        }

        dbContext.CampaignAssignmentResponsibilities.Add(responsibility);
        cycle.RecordResponsibilityChange();
        dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
            tenantContext.TenantId, cycle.Id, PerformanceCycleAuditAction.ResponsibilityCurated,
            currentUser.UserId, currentUser.FullName,
            $"{request.Duty} responsibility curated for subject {request.SubjectEmployeeId}."));
        await dbContext.SaveChangesAsync(cancellationToken);
        var summary = new CampaignResponsibilitySummaryDto(responsibility.Id, responsibility.AssigneeEmployeeId,
            responsibility.AssigneeName, responsibility.Duty.ToString(), responsibility.Source.ToString(),
            responsibility.RelationshipSource, responsibility.OverrideReason, responsibility.Revision, responsibility.RecordedAt);
        return new CuratedCampaignResponsibilityDto(summary, cycle.Version);
    }
}

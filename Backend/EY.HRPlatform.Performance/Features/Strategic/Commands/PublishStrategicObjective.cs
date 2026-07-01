using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Strategic.Commands;

public sealed record PublishStrategicObjectiveCommand(Guid Id, uint ExpectedVersion) : ICommand<Result>;

public sealed class PublishStrategicObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor) : ICommandHandler<PublishStrategicObjectiveCommand, Result>
{
    public async Task<Result> Handle(PublishStrategicObjectiveCommand request, CancellationToken cancellationToken)
    {
        // D-05: deny-by-default publish permission
        if (!accessPolicy.CanPublishStrategicObjectives(httpContextAccessor.HttpContext!.User))
            return Result.Failure(Error.Forbidden("Strategic.Forbidden", "You do not have permission to publish strategic objectives."));

        // Load the objective to publish (tenant-filtered by DbContext)
        var objective = await dbContext.StrategicObjectives
            .SingleOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
        if (objective is null)
            return Result.Failure(Error.NotFound("StrategicObjective", request.Id));

        // Optimistic concurrency guard (T-03-07, T-03-09)
        ConcurrencyGuard.Ensure(objective.Version, request.ExpectedVersion, nameof(StrategicObjective), objective.Id);

        var now = DateTime.UtcNow;
        var tenantId = objective.TenantId;

        try
        {
            // D-03: query for any existing current Published version in the same tenant+scope+period
            var existingPublished = await dbContext.StrategicObjectives
                .SingleOrDefaultAsync(o =>
                    o.TenantId == tenantId &&
                    o.OrgScope == objective.OrgScope &&
                    o.PeriodId == objective.PeriodId &&
                    o.Status == StrategicObjectiveStatus.Published,
                    cancellationToken);

            int newVersionNumber = 1;

            if (existingPublished is not null)
            {
                // Supersede the prior published version (D-03: immutable history, D-04: no rewrite)
                existingPublished.Supersede(objective.Id, now);
                newVersionNumber = existingPublished.VersionNumber + 1;

                // Audit: StrategicObjectiveSuperseded (D-14, T-03-08)
                dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                    tenantId,
                    existingPublished.Id,   // use the superseded objective id as the context id
                    PerformanceCycleAuditAction.StrategicObjectiveSuperseded,
                    currentUser.UserId,
                    currentUser.FullName,
                    $"Version {existingPublished.VersionNumber} of strategic objective '{existingPublished.Title}' superseded by new version {newVersionNumber}.",
                    outcome: "Success",
                    correlationId: currentUser.CorrelationId));
            }

            // Advance monotonic version number and publish
            objective.SetVersionNumber(newVersionNumber);
            objective.Publish(now);

            // Audit: StrategicObjectivePublished (D-14, T-03-08)
            dbContext.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                tenantId,
                objective.Id,
                PerformanceCycleAuditAction.StrategicObjectivePublished,
                currentUser.UserId,
                currentUser.FullName,
                $"Strategic objective '{objective.Title}' published as version {newVersionNumber} for scope '{objective.OrgScope}'.",
                outcome: "Success",
                correlationId: currentUser.CorrelationId));

            await dbContext.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (DomainRuleViolationException ex)
        {
            return Result.Failure(Error.Conflict("Strategic.Conflict.InvalidTransition", ex.Message));
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException(nameof(StrategicObjective), objective.Id);
        }
    }
}

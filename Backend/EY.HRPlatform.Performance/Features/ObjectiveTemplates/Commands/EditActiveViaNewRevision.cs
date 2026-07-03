using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;

public sealed record EditActiveViaNewRevisionCommand(
    Guid TemplateId,
    ClaimsPrincipal Actor,
    CreateTemplateDraftRequest Request) : ICommand<Result<TemplateDto>>;

public sealed class EditActiveViaNewRevisionCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit,
    ICoreWorkforceClient coreWorkforceClient)
    : ICommandHandler<EditActiveViaNewRevisionCommand, Result<TemplateDto>>
{
    public async Task<Result<TemplateDto>> Handle(
        EditActiveViaNewRevisionCommand command,
        CancellationToken cancellationToken)
    {
        var actorId = command.Actor.GetUserId();
        var actorName = command.Actor.GetFullName();
        var req = command.Request;

        var template = await db.ObjectiveTemplateContainers
            .Include(t => t.Revisions)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == command.TemplateId, cancellationToken);

        if (template is null)
            return Result.Failure<TemplateDto>(Error.NotFound("ObjectiveTemplate", command.TemplateId));

        if (template.DraftRevision is not null)
            return Result.Failure<TemplateDto>(
                Error.Conflict("ObjectiveTemplate.DraftExists",
                    "A draft revision already exists. Discard or activate it before creating a new one."));

        var sourceRevisionId = template.ActiveRevision?.Id ?? req.SourceRevisionId;
        var nextVersion = template.Revisions.Count == 0
            ? 1
            : template.Revisions.Max(r => r.VersionNumber) + 1;

        var revision = ObjectiveTemplateRevision.Create(
            tenantContext.TenantId,
            template.Id,
            nextVersion,
            req.Title,
            req.Description,
            req.CategoryId,
            req.MeasurementType,
            req.SuggestedWeighting,
            req.Tags,
            req.TargetValue,
            req.Unit,
            req.SuccessCriteria,
            actorId.ToString(),
            actorName,
            sourceRevisionId,
            req.ApplicableOrgUnitIds,
            req.ApplicableJobTitles,
            req.ApplicableWorkLocations,
            req.ApplicableEmploymentTypes,
            req.Indicator,
            req.ExpectedOutcome);

        if (req.ApplicableOrgUnitIds is { Count: > 0 })
        {
            var options = await coreWorkforceClient.GetApplicabilityOptionsAsync(cancellationToken);
            var available = options.OrgUnits.Select(o => o.Id).ToHashSet();
            var state = req.ApplicableOrgUnitIds.All(id => available.Contains(id)) ? "Valid" : "HasUnresolved";
            revision.SetApplicabilityValidationState(state);
        }

        db.ObjectiveTemplateRevisions.Add(revision);

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            actorId, actorName,
            "TemplateNewRevisionStarted", "ObjectiveTemplate", template.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);

        var refreshed = await db.ObjectiveTemplateContainers
            .Include(t => t.Revisions)
            .AsNoTracking()
            .FirstAsync(t => t.Id == template.Id, cancellationToken);

        return TemplateMapper.ToTemplateDto(refreshed);
    }
}

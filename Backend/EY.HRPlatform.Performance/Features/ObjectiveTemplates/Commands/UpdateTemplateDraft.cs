using EY.HRPlatform.Performance.Exceptions;
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

public sealed record UpdateTemplateDraftCommand(
    Guid TemplateId,
    ClaimsPrincipal Actor,
    UpdateTemplateDraftRequest Request) : ICommand<Result<TemplateDto>>;

public sealed class UpdateTemplateDraftCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit,
    ICoreWorkforceClient coreWorkforceClient)
    : ICommandHandler<UpdateTemplateDraftCommand, Result<TemplateDto>>
{
    public async Task<Result<TemplateDto>> Handle(
        UpdateTemplateDraftCommand command,
        CancellationToken cancellationToken)
    {
        var actorId = command.Actor.GetUserId();
        var actorName = command.Actor.GetFullName();
        var req = command.Request;

        var template = await db.ObjectiveTemplateContainers
            .Include(t => t.Revisions)
            .FirstOrDefaultAsync(t => t.Id == command.TemplateId, cancellationToken);

        if (template is null)
            return Result.Failure<TemplateDto>(Error.NotFound("ObjectiveTemplate", command.TemplateId));

        var draft = template.DraftRevision;
        if (draft is null)
            return Result.Failure<TemplateDto>(
                new Error("ObjectiveTemplate.NoDraft", "This template has no draft revision to update."));

        if (draft.Version != req.ExpectedVersion)
            return Result.Failure<TemplateDto>(
                Error.Conflict("ObjectiveTemplate.Conflict",
                    "The revision has been modified by another user. Reload and try again."));

        draft.UpdateDraft(
            req.Title,
            req.Description,
            req.CategoryId,
            req.MeasurementType,
            req.SuggestedWeighting,
            req.Tags,
            req.TargetValue,
            req.Unit,
            req.SuccessCriteria,
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
            draft.SetApplicabilityValidationState(state);
        }

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            actorId, actorName,
            "TemplateDraftUpdated", "ObjectiveTemplate", template.Id,
            versionNumber: draft.VersionNumber,
            cancellationToken: cancellationToken);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConcurrencyException("ObjectiveTemplateRevision", draft.Id);
        }

        return TemplateMapper.ToTemplateDto(template);
    }
}

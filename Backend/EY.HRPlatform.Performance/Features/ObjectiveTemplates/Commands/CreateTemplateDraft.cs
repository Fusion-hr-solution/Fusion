using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;

public sealed record CreateTemplateDraftCommand(
    ClaimsPrincipal Actor,
    CreateTemplateDraftRequest Request) : ICommand<Result<TemplateDto>>;

public sealed class CreateTemplateDraftCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit,
    ICoreWorkforceClient coreWorkforceClient)
    : ICommandHandler<CreateTemplateDraftCommand, Result<TemplateDto>>
{
    public async Task<Result<TemplateDto>> Handle(
        CreateTemplateDraftCommand command,
        CancellationToken cancellationToken)
    {
        var actorId = command.Actor.GetUserId();
        var actorName = command.Actor.GetFullName();
        var req = command.Request;

        var template = ObjectiveTemplate.Create(tenantContext.TenantId);
        var draft = template.CreateDraftRevision(
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
            req.SourceRevisionId,
            req.ApplicableOrgUnitIds,
            req.ApplicableJobTitles,
            req.ApplicableWorkLocations,
            req.ApplicableEmploymentTypes);

        if (req.ApplicableOrgUnitIds is { Count: > 0 })
        {
            var state = await ResolveApplicabilityStateAsync(req.ApplicableOrgUnitIds, cancellationToken);
            draft.SetApplicabilityValidationState(state);
        }

        db.ObjectiveTemplateContainers.Add(template);

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            actorId, actorName,
            "TemplateDraftCreated", "ObjectiveTemplate", template.Id,
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return TemplateMapper.ToTemplateDto(template);
    }

    private async Task<string> ResolveApplicabilityStateAsync(
        IReadOnlyList<Guid> requestedOrgUnitIds,
        CancellationToken cancellationToken)
    {
        var options = await coreWorkforceClient.GetApplicabilityOptionsAsync(cancellationToken);
        var available = options.OrgUnits.Select(o => o.Id).ToHashSet();
        return requestedOrgUnitIds.All(id => available.Contains(id)) ? "Valid" : "HasUnresolved";
    }
}

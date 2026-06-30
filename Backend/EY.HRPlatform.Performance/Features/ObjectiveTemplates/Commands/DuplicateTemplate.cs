using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;

public sealed record DuplicateTemplateCommand(
    Guid SourceTemplateId,
    ClaimsPrincipal Actor) : ICommand<Result<TemplateDto>>;

public sealed class DuplicateTemplateCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    IConfigurationAuditWriter audit)
    : ICommandHandler<DuplicateTemplateCommand, Result<TemplateDto>>
{
    public async Task<Result<TemplateDto>> Handle(
        DuplicateTemplateCommand command,
        CancellationToken cancellationToken)
    {
        var actorId = command.Actor.GetUserId();
        var actorName = command.Actor.GetFullName();

        var source = await db.ObjectiveTemplateContainers
            .Include(t => t.Revisions)
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == command.SourceTemplateId, cancellationToken);

        if (source is null)
            return Result.Failure<TemplateDto>(Error.NotFound("ObjectiveTemplate", command.SourceTemplateId));

        var sourceRevision = source.ActiveRevision ?? source.DraftRevision;
        if (sourceRevision is null)
            return Result.Failure<TemplateDto>(
                new Error("ObjectiveTemplate.NoRevision", "Source template has no revision to duplicate."));

        var newTemplate = ObjectiveTemplate.Create(tenantContext.TenantId);
        newTemplate.CreateDraftRevision(
            title: $"{sourceRevision.Title} (Copy)",
            description: sourceRevision.Description,
            categoryId: sourceRevision.CategoryId,
            measurementType: sourceRevision.MeasurementType,
            suggestedWeighting: sourceRevision.SuggestedWeighting,
            tags: sourceRevision.Tags,
            targetValue: sourceRevision.TargetValue,
            unit: sourceRevision.Unit,
            successCriteria: sourceRevision.SuccessCriteria,
            createdByUserId: actorId.ToString(),
            createdByName: actorName,
            sourceRevisionId: sourceRevision.Id,
            applicableOrgUnitIds: sourceRevision.ApplicableOrgUnitIds,
            applicableJobTitles: sourceRevision.ApplicableJobTitles,
            applicableWorkLocations: sourceRevision.ApplicableWorkLocations,
            applicableEmploymentTypes: sourceRevision.ApplicableEmploymentTypes);

        // Carry over the applicability validation state from the source
        var draft = newTemplate.DraftRevision!;
        draft.SetApplicabilityValidationState(sourceRevision.ApplicabilityValidationState);

        db.ObjectiveTemplateContainers.Add(newTemplate);

        await audit.AppendTenantAsync(
            tenantContext.TenantId,
            actorId, actorName,
            "TemplateDuplicated", "ObjectiveTemplate", newTemplate.Id,
            previousValue: command.SourceTemplateId.ToString(),
            cancellationToken: cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return TemplateMapper.ToTemplateDto(newTemplate);
    }
}

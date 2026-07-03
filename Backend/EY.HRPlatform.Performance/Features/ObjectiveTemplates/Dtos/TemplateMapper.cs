using EY.HRPlatform.Performance.Domain.Entities;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;

public static class TemplateMapper
{
    public static TemplateRevisionDto ToRevisionDto(ObjectiveTemplateRevision r)
        => new(
            r.Id, r.TemplateId, r.VersionNumber, r.Status.ToString(),
            r.Title, r.Description, r.CategoryId,
            r.MeasurementType, r.SuggestedWeighting, r.Tags,
            r.Indicator, r.TargetValue, r.Unit,
            r.ExpectedOutcome, r.SuccessCriteria,
            r.Version, r.SourceRevisionId,
            r.CreatedByUserId, r.CreatedByName,
            r.ActivatedAt, r.ActivatedByUserId, r.ActivatedByName,
            r.ChangeSummary, r.SupersededAt,
            r.CreatedAt, r.UpdatedAt,
            r.ApplicableOrgUnitIds, r.ApplicableJobTitles,
            r.ApplicableWorkLocations, r.ApplicableEmploymentTypes,
            r.ApplicabilityValidationState);

    public static TemplateDto ToTemplateDto(ObjectiveTemplate t)
        => new(
            t.Id, t.TenantId, t.Code, t.Status.ToString(),
            t.ActiveRevision is { } a ? ToRevisionDto(a) : null,
            t.DraftRevision is { } d ? ToRevisionDto(d) : null,
            t.CreatedAt, t.UpdatedAt);
}

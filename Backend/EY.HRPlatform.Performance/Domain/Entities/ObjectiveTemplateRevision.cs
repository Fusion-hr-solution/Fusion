using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public class ObjectiveTemplateRevision : BaseEntity, ITenantEntity
{
    private ObjectiveTemplateRevision() { }

    public Guid TenantId { get; private set; }
    public Guid TemplateId { get; private set; }
    public int VersionNumber { get; private set; }
    public ObjectiveTemplateRevisionStatus Status { get; private set; }

    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public Guid? CategoryId { get; private set; }

    public string MeasurementType { get; private set; } = string.Empty;
    public decimal? SuggestedWeighting { get; private set; }
    public string? Tags { get; private set; }

    // Applicability
    public IReadOnlyList<Guid> ApplicableOrgUnitIds { get; private set; } = [];
    public IReadOnlyList<string> ApplicableJobTitles { get; private set; } = [];
    public IReadOnlyList<string> ApplicableWorkLocations { get; private set; } = [];
    public IReadOnlyList<string> ApplicableEmploymentTypes { get; private set; } = [];
    // "NotValidated" | "Valid" | "HasUnresolved"
    public string ApplicabilityValidationState { get; private set; } = "NotValidated";

    // Quantitative (P1.1 §13.4: indicator, target definition, unit)
    public string? Indicator { get; private set; }
    public decimal? TargetValue { get; private set; }
    public string? Unit { get; private set; }

    // Qualitative (P1.1 §13.5: two distinct concepts, never collapsed into one field)
    public string? ExpectedOutcome { get; private set; }
    public string? SuccessCriteria { get; private set; }

    public uint Version { get; private set; }

    public Guid? SourceRevisionId { get; private set; }

    public string CreatedByUserId { get; private set; } = string.Empty;
    public string? CreatedByName { get; private set; }
    public DateTime? ActivatedAt { get; private set; }
    public string? ActivatedByUserId { get; private set; }
    public string? ActivatedByName { get; private set; }
    public string? ChangeSummary { get; private set; }
    public DateTime? SupersededAt { get; private set; }

    public ObjectiveTemplate? Template { get; private set; }
    public ObjectiveTemplateCategory? Category { get; private set; }

    internal static ObjectiveTemplateRevision Create(
        Guid tenantId,
        Guid templateId,
        int versionNumber,
        string title,
        string? description,
        Guid? categoryId,
        string measurementType,
        decimal? suggestedWeighting,
        string? tags,
        decimal? targetValue,
        string? unit,
        string? successCriteria,
        string createdByUserId,
        string? createdByName,
        Guid? sourceRevisionId,
        IReadOnlyList<Guid>? applicableOrgUnitIds = null,
        IReadOnlyList<string>? applicableJobTitles = null,
        IReadOnlyList<string>? applicableWorkLocations = null,
        IReadOnlyList<string>? applicableEmploymentTypes = null,
        string? indicator = null,
        string? expectedOutcome = null)
    {
        ValidateTitle(title);
        ValidateMeasurementType(measurementType);

        return new ObjectiveTemplateRevision
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TemplateId = templateId,
            VersionNumber = versionNumber,
            Status = ObjectiveTemplateRevisionStatus.Draft,
            Title = title.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            CategoryId = categoryId,
            MeasurementType = measurementType,
            SuggestedWeighting = suggestedWeighting,
            Tags = string.IsNullOrWhiteSpace(tags) ? null : tags.Trim(),
            Indicator = string.IsNullOrWhiteSpace(indicator) ? null : indicator.Trim(),
            TargetValue = targetValue,
            Unit = string.IsNullOrWhiteSpace(unit) ? null : unit.Trim(),
            ExpectedOutcome = string.IsNullOrWhiteSpace(expectedOutcome) ? null : expectedOutcome.Trim(),
            SuccessCriteria = string.IsNullOrWhiteSpace(successCriteria) ? null : successCriteria.Trim(),
            CreatedByUserId = createdByUserId,
            CreatedByName = createdByName,
            SourceRevisionId = sourceRevisionId,
            ApplicableOrgUnitIds = applicableOrgUnitIds ?? [],
            ApplicableJobTitles = applicableJobTitles ?? [],
            ApplicableWorkLocations = applicableWorkLocations ?? [],
            ApplicableEmploymentTypes = applicableEmploymentTypes ?? [],
            ApplicabilityValidationState = "NotValidated",
        };
    }

    public void UpdateDraft(
        string title,
        string? description,
        Guid? categoryId,
        string measurementType,
        decimal? suggestedWeighting,
        string? tags,
        decimal? targetValue,
        string? unit,
        string? successCriteria,
        IReadOnlyList<Guid>? applicableOrgUnitIds = null,
        IReadOnlyList<string>? applicableJobTitles = null,
        IReadOnlyList<string>? applicableWorkLocations = null,
        IReadOnlyList<string>? applicableEmploymentTypes = null,
        string? indicator = null,
        string? expectedOutcome = null)
    {
        if (Status != ObjectiveTemplateRevisionStatus.Draft)
            throw new DomainRuleViolationException("Only draft revisions can be updated.");

        ValidateTitle(title);
        ValidateMeasurementType(measurementType);

        Title = title.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        CategoryId = categoryId;
        MeasurementType = measurementType;
        SuggestedWeighting = suggestedWeighting;
        Tags = string.IsNullOrWhiteSpace(tags) ? null : tags.Trim();
        Indicator = string.IsNullOrWhiteSpace(indicator) ? null : indicator.Trim();
        TargetValue = targetValue;
        Unit = string.IsNullOrWhiteSpace(unit) ? null : unit.Trim();
        ExpectedOutcome = string.IsNullOrWhiteSpace(expectedOutcome) ? null : expectedOutcome.Trim();
        SuccessCriteria = string.IsNullOrWhiteSpace(successCriteria) ? null : successCriteria.Trim();
        ApplicableOrgUnitIds = applicableOrgUnitIds ?? [];
        ApplicableJobTitles = applicableJobTitles ?? [];
        ApplicableWorkLocations = applicableWorkLocations ?? [];
        ApplicableEmploymentTypes = applicableEmploymentTypes ?? [];
        ApplicabilityValidationState = "NotValidated";
        UpdatedAt = DateTime.UtcNow;
    }

    internal void SetApplicabilityValidationState(string state)
    {
        ApplicabilityValidationState = state;
        UpdatedAt = DateTime.UtcNow;
    }

    internal void Activate(string actorId, string? actorName, string? changeSummary)
    {
        if (Status != ObjectiveTemplateRevisionStatus.Draft)
            throw new DomainRuleViolationException("Only draft revisions can be activated.");

        Status = ObjectiveTemplateRevisionStatus.Active;
        ActivatedAt = DateTime.UtcNow;
        ActivatedByUserId = actorId;
        ActivatedByName = actorName;
        ChangeSummary = changeSummary;
        UpdatedAt = DateTime.UtcNow;
    }

    internal void Supersede()
    {
        if (Status != ObjectiveTemplateRevisionStatus.Active)
            throw new DomainRuleViolationException("Only active revisions can be superseded.");

        Status = ObjectiveTemplateRevisionStatus.Superseded;
        SupersededAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    private static void ValidateTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Template title cannot be empty.", nameof(title));
        if (title.Trim().Length > 200)
            throw new ArgumentException("Template title cannot exceed 200 characters.", nameof(title));
    }

    private static void ValidateMeasurementType(string measurementType)
    {
        if (measurementType is not ("Quantitative" or "Qualitative"))
            throw new ArgumentException(
                $"Invalid measurement type '{measurementType}'. Must be 'Quantitative' or 'Qualitative'.",
                nameof(measurementType));
    }
}

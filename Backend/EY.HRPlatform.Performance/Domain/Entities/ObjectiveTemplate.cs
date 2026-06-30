using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// Stable-identity objective template container. One per logical template; content lives in revisions.
/// </summary>
public class ObjectiveTemplate : AggregateRoot, ITenantEntity
{
    private readonly List<ObjectiveTemplateRevision> _revisions = new();

    private ObjectiveTemplate() { }

    public Guid TenantId { get; private set; }
    public ObjectiveTemplateStatus Status { get; private set; }

    public IReadOnlyList<ObjectiveTemplateRevision> Revisions => _revisions.AsReadOnly();
    public ObjectiveTemplateRevision? ActiveRevision
        => _revisions.SingleOrDefault(r => r.Status == ObjectiveTemplateRevisionStatus.Active);
    public ObjectiveTemplateRevision? DraftRevision
        => _revisions.SingleOrDefault(r => r.Status == ObjectiveTemplateRevisionStatus.Draft);

    public static ObjectiveTemplate Create(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        return new ObjectiveTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Status = ObjectiveTemplateStatus.Draft,
        };
    }

    public ObjectiveTemplateRevision CreateDraftRevision(
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
        Guid? sourceRevisionId = null,
        IReadOnlyList<Guid>? applicableOrgUnitIds = null,
        IReadOnlyList<string>? applicableJobTitles = null,
        IReadOnlyList<string>? applicableWorkLocations = null,
        IReadOnlyList<string>? applicableEmploymentTypes = null)
    {
        if (DraftRevision is not null)
            throw new DomainRuleViolationException("A draft revision already exists for this template.");

        var nextVersion = _revisions.Count == 0 ? 1 : _revisions.Max(r => r.VersionNumber) + 1;

        var revision = ObjectiveTemplateRevision.Create(
            TenantId, Id, nextVersion,
            title, description, categoryId,
            measurementType, suggestedWeighting, tags,
            targetValue, unit, successCriteria,
            createdByUserId, createdByName, sourceRevisionId,
            applicableOrgUnitIds, applicableJobTitles,
            applicableWorkLocations, applicableEmploymentTypes);

        _revisions.Add(revision);
        UpdatedAt = DateTime.UtcNow;
        return revision;
    }

    public void ActivateRevision(string actorId, string? actorName, string? changeSummary)
    {
        var draft = DraftRevision
            ?? throw new DomainRuleViolationException("No draft revision exists to activate.");

        ActiveRevision?.Supersede();
        draft.Activate(actorId, actorName, changeSummary);

        Status = ObjectiveTemplateStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        if (Status == ObjectiveTemplateStatus.Archived)
            throw new DomainRuleViolationException("Template is already archived.");

        Status = ObjectiveTemplateStatus.Archived;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Restore()
    {
        if (Status != ObjectiveTemplateStatus.Archived)
            throw new DomainRuleViolationException("Only archived templates can be restored.");

        Status = ActiveRevision is not null ? ObjectiveTemplateStatus.Active : ObjectiveTemplateStatus.Draft;
        UpdatedAt = DateTime.UtcNow;
    }
}

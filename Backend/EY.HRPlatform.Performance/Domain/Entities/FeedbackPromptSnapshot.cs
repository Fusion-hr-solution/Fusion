using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An ordered prompt within a frozen feedback template snapshot.
/// Analog: FormalReviewCriterionSnapshot.
/// </summary>
public sealed class FeedbackPromptSnapshot : BaseEntity, ITenantEntity
{
    private FeedbackPromptSnapshot() { }

    public Guid TenantId { get; private set; }
    public Guid TemplateSnapshotId { get; private set; }
    public string PromptText { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool IsRequired { get; private set; }
    public int DisplayOrder { get; private set; }
    public int Version { get; private set; }

    internal static FeedbackPromptSnapshot Create(
        Guid tenantId,
        Guid templateSnapshotId,
        string promptText,
        string? description,
        bool isRequired,
        int displayOrder,
        int version = 1)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (templateSnapshotId == Guid.Empty)
            throw new ArgumentException("TemplateSnapshotId cannot be empty.", nameof(templateSnapshotId));
        if (string.IsNullOrWhiteSpace(promptText))
            throw new ArgumentException("Prompt text is required.", nameof(promptText));
        if (displayOrder <= 0)
            throw new ArgumentOutOfRangeException(nameof(displayOrder), "Display order must be positive.");

        return new FeedbackPromptSnapshot
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            TemplateSnapshotId = templateSnapshotId,
            PromptText = promptText.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            IsRequired = isRequired,
            DisplayOrder = displayOrder,
            Version = version
        };
    }
}

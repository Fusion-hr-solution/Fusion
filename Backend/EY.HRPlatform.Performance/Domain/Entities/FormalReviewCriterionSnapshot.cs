using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class FormalReviewCriterionSnapshot : BaseEntity, ITenantEntity
{
    private FormalReviewCriterionSnapshot() { }

    public Guid TenantId { get; private set; }
    public Guid DefinitionSnapshotId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public int DisplayOrder { get; private set; }

    internal static FormalReviewCriterionSnapshot Create(Guid tenantId, Guid definitionSnapshotId, string name, string? description, int displayOrder)
    {
        if (displayOrder <= 0) throw new ArgumentOutOfRangeException(nameof(displayOrder));
        return new FormalReviewCriterionSnapshot
        {
            Id = Guid.NewGuid(), TenantId = tenantId, DefinitionSnapshotId = definitionSnapshotId,
            Name = name.Trim(), Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(), DisplayOrder = displayOrder
        };
    }
}

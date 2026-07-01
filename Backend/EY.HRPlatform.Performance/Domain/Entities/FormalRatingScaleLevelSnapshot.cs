using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class FormalRatingScaleLevelSnapshot : BaseEntity, ITenantEntity
{
    private FormalRatingScaleLevelSnapshot() { }

    public Guid TenantId { get; private set; }
    public Guid DefinitionSnapshotId { get; private set; }
    public int Value { get; private set; }
    public string Label { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    internal static FormalRatingScaleLevelSnapshot Create(Guid tenantId, Guid definitionSnapshotId, int value, string label, string? description)
        => new()
        {
            Id = Guid.NewGuid(), TenantId = tenantId, DefinitionSnapshotId = definitionSnapshotId,
            Value = value, Label = label.Trim(), Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim()
        };
}

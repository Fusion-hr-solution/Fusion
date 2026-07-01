using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class PerformanceReviewCriterionResponse : BaseEntity, ITenantEntity
{
    private PerformanceReviewCriterionResponse() { }

    public Guid TenantId { get; private set; }
    public Guid ReviewId { get; private set; }
    public Guid CriterionSnapshotId { get; private set; }
    public int Rating { get; private set; }
    public string? Comment { get; private set; }

    internal static PerformanceReviewCriterionResponse Create(ReviewCriterionResponse response) => new()
    {
        Id = Guid.NewGuid(), CriterionSnapshotId = response.CriterionSnapshotId, Rating = response.Rating,
        Comment = string.IsNullOrWhiteSpace(response.Comment) ? null : response.Comment.Trim()
    };

    internal void SetOwner(Guid tenantId, Guid reviewId)
    {
        TenantId = tenantId;
        ReviewId = reviewId;
    }
}

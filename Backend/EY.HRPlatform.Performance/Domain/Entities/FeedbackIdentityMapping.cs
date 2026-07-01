using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// Separate identity mapping (D-05): ResponseId → WorkItemId → ReviewerEmployeeId.
/// Stored with stricter authorization — never joined in normal read paths (D-06).
/// </summary>
public sealed class FeedbackIdentityMapping : BaseEntity, ITenantEntity
{
    private FeedbackIdentityMapping() { }

    public Guid TenantId { get; private set; }
    public Guid ResponseContentId { get; private set; }
    public Guid WorkItemId { get; private set; }
    public Guid ReviewerEmployeeId { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public static FeedbackIdentityMapping Create(
        Guid tenantId,
        Guid responseContentId,
        Guid workItemId,
        Guid reviewerEmployeeId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (responseContentId == Guid.Empty)
            throw new ArgumentException("ResponseContentId cannot be empty.", nameof(responseContentId));
        if (workItemId == Guid.Empty)
            throw new ArgumentException("WorkItemId cannot be empty.", nameof(workItemId));
        if (reviewerEmployeeId == Guid.Empty)
            throw new ArgumentException("ReviewerEmployeeId cannot be empty.", nameof(reviewerEmployeeId));

        return new FeedbackIdentityMapping
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ResponseContentId = responseContentId,
            WorkItemId = workItemId,
            ReviewerEmployeeId = reviewerEmployeeId,
            CreatedAt = DateTime.UtcNow
        };
    }
}

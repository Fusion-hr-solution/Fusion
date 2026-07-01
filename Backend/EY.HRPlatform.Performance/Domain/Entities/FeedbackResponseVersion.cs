using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// Append-only revision history for a feedback response (D-14).
/// Every revision creates a new version record; prior content is never overwritten.
/// </summary>
public sealed class FeedbackResponseVersion : BaseEntity, ITenantEntity
{
    private FeedbackResponseVersion() { }

    public Guid TenantId { get; private set; }
    public Guid ResponseContentId { get; private set; }
    public int VersionNumber { get; private set; }
    public string AnswersJson { get; private set; } = string.Empty;
    public string? GeneralComment { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid AuthorEmployeeId { get; private set; }

    public static FeedbackResponseVersion Create(
        Guid tenantId,
        Guid responseContentId,
        int versionNumber,
        string answersJson,
        string? generalComment,
        Guid authorEmployeeId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (responseContentId == Guid.Empty)
            throw new ArgumentException("ResponseContentId cannot be empty.", nameof(responseContentId));
        if (versionNumber <= 0)
            throw new ArgumentOutOfRangeException(nameof(versionNumber), "Version number must be positive.");
        if (string.IsNullOrWhiteSpace(answersJson))
            throw new ArgumentException("Answers JSON is required.", nameof(answersJson));
        if (authorEmployeeId == Guid.Empty)
            throw new ArgumentException("AuthorEmployeeId cannot be empty.", nameof(authorEmployeeId));

        return new FeedbackResponseVersion
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ResponseContentId = responseContentId,
            VersionNumber = versionNumber,
            AnswersJson = answersJson.Trim(),
            GeneralComment = string.IsNullOrWhiteSpace(generalComment) ? null : generalComment.Trim(),
            CreatedAt = DateTime.UtcNow,
            AuthorEmployeeId = authorEmployeeId
        };
    }
}

using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A single prompt answer within a feedback response. Preserves the exact prompt text and
/// version it was submitted against (D-04: prompt text preservation).
/// </summary>
public sealed class FeedbackPromptAnswer : BaseEntity, ITenantEntity
{
    private FeedbackPromptAnswer() { }

    public Guid TenantId { get; private set; }
    public Guid ResponseContentId { get; private set; }
    public Guid PromptSnapshotId { get; private set; }
    public string PromptText { get; private set; } = string.Empty;
    public int PromptVersion { get; private set; }
    public string AnswerText { get; private set; } = string.Empty;
    public bool IsRequired { get; private set; }

    internal static FeedbackPromptAnswer Create(
        Guid tenantId,
        Guid responseContentId,
        Guid promptSnapshotId,
        string promptText,
        int promptVersion,
        string answerText,
        bool isRequired)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (responseContentId == Guid.Empty)
            throw new ArgumentException("ResponseContentId cannot be empty.", nameof(responseContentId));
        if (promptSnapshotId == Guid.Empty)
            throw new ArgumentException("PromptSnapshotId cannot be empty.", nameof(promptSnapshotId));
        if (string.IsNullOrWhiteSpace(promptText))
            throw new ArgumentException("Prompt text is required.", nameof(promptText));

        return new FeedbackPromptAnswer
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ResponseContentId = responseContentId,
            PromptSnapshotId = promptSnapshotId,
            PromptText = promptText.Trim(),
            PromptVersion = promptVersion,
            AnswerText = string.IsNullOrWhiteSpace(answerText) ? string.Empty : answerText.Trim(),
            IsRequired = isRequired
        };
    }
}

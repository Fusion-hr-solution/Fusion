using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// The immutable feedback template used by a campaign. Deliberately copies prompt definitions
/// so later template changes cannot alter an active or closed feedback window.
/// Analog: FormalReviewDefinitionSnapshot.
/// </summary>
public sealed class FeedbackTemplateSnapshot : AggregateRoot, ITenantEntity
{
    private readonly List<FeedbackPromptSnapshot> _prompts = [];

    private FeedbackTemplateSnapshot() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public FeedbackResponseType FeedbackType { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public DateTime FrozenAt { get; private set; }
    public IReadOnlyCollection<FeedbackPromptSnapshot> Prompts => _prompts.AsReadOnly();

    public static FeedbackTemplateSnapshot Create(
        Guid tenantId,
        Guid cycleId,
        FeedbackResponseType feedbackType,
        string name,
        IEnumerable<FeedbackPromptDefinition> prompts,
        DateTime frozenAt)
    {
        if (tenantId == Guid.Empty || cycleId == Guid.Empty)
            throw new ArgumentException("Tenant and campaign are required.");
        if (!Enum.IsDefined(feedbackType))
            throw new ArgumentOutOfRangeException(nameof(feedbackType));

        var promptValues = prompts?.OrderBy(item => item.DisplayOrder).ToList()
            ?? throw new ArgumentNullException(nameof(prompts));
        if (promptValues.Count == 0 || promptValues.Any(item => string.IsNullOrWhiteSpace(item.PromptText)) ||
            promptValues.Select(item => item.DisplayOrder).Distinct().Count() != promptValues.Count)
            throw new ArgumentException("A template requires uniquely ordered prompts.", nameof(prompts));

        var snapshot = new FeedbackTemplateSnapshot
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            FeedbackType = feedbackType,
            Name = Required(name, 200, nameof(name)),
            FrozenAt = NormalizeUtc(frozenAt)
        };
        snapshot._prompts.AddRange(promptValues.Select(item => FeedbackPromptSnapshot.Create(
            tenantId, snapshot.Id, item.PromptText, item.Description, item.IsRequired, item.DisplayOrder)));
        return snapshot;
    }

    private static string Required(string value, int maximum, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("A value is required.", parameterName);
        var normalized = value.Trim();
        if (normalized.Length > maximum)
            throw new ArgumentOutOfRangeException(parameterName, $"Value cannot exceed {maximum} characters.");
        return normalized;
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        if (value == default) throw new ArgumentException("A frozen timestamp is required.", nameof(value));
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}

public sealed record FeedbackPromptDefinition(string PromptText, string? Description, bool IsRequired, int DisplayOrder);

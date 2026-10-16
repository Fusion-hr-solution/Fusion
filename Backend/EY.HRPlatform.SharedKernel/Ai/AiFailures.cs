using System.Text.Json.Serialization;

namespace EY.HRPlatform.SharedKernel.Ai;

/// <summary>Why an AI provider call failed, in terms a caller can act on. Never carries provider text.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AiFailureCategory
{
    NotConfigured,
    Unauthorized,
    ProviderRejected,
    Timeout,
    RateLimited,
    ProviderUnavailable,
    InvalidOutput,
    Interrupted,
}

public static class AiFailures
{
    /// <summary>Failures worth another attempt: the provider may answer next time. Configuration and credential failures will not.</summary>
    public static bool IsTransient(AiFailureCategory category)
        => category is AiFailureCategory.Timeout
            or AiFailureCategory.RateLimited
            or AiFailureCategory.ProviderUnavailable
            or AiFailureCategory.InvalidOutput
            or AiFailureCategory.Interrupted;
}

/// <summary>
/// A failed provider call. The message is safe to show; the provider's response body never reaches it.
/// </summary>
public sealed class AiProviderException(
    AiFailureCategory category,
    string safeMessage,
    DateTime? retryAfter = null,
    Exception? innerException = null) : Exception(safeMessage, innerException)
{
    public AiFailureCategory Category { get; } = category;
    public DateTime? RetryAfter { get; } = retryAfter;
    public bool Retryable => AiFailures.IsTransient(Category);
}

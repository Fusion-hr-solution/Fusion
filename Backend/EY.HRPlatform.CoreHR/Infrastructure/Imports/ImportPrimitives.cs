using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EY.HRPlatform.CoreHR.Infrastructure.Imports;

// Concrete primitives shared by the Organization and Workforce import domains. Each is a fact both
// domains hold identically; domain rules (fields, issues, classifications) stay domain-owned.

/// <summary>Who performed an import action, normalized for audit display.</summary>
public sealed record ImportActor(Guid UserId, string DisplayName)
{
    public ImportActor Normalize()
        => new(UserId, string.IsNullOrWhiteSpace(DisplayName)
            ? "Unknown"
            : DisplayName.Trim()[..Math.Min(DisplayName.Trim().Length, 256)]);
}

/// <summary>Where a Match decision came from. An administrator decision always outranks a suggestion.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImportResolutionOrigin { Native, Deterministic, Administrator, SemanticSuggestion }

/// <summary>A blocker means Fusion cannot publish; a warning means it can, but something deserves a look.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImportIssueSeverity { Blocker, Warning }

/// <summary>Automatic when every Match decision is Native/Deterministic; Confirmed when any needed a person or a suggestion.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImportMatchCompletionKind { Incomplete, Automatic, Confirmed }

/// <summary>Deterministic hashing and comparison for source, plan and proposal fingerprints.</summary>
public static class ImportFingerprint
{
    private static readonly JsonSerializerOptions CanonicalJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    /// <summary>Lowercase hex SHA-256 of the UTF-8 value.</summary>
    public static string Hash(string value)
        => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    /// <summary>Hash of the value's camelCase JSON. Callers own ordering of any collections inside it.</summary>
    public static string HashCanonical<T>(T value)
        => Hash(JsonSerializer.Serialize(value, CanonicalJson));

    /// <summary>Constant-time comparison of two fingerprints; null/blank never matches.</summary>
    public static bool Matches(string? expected, string? actual)
    {
        if (string.IsNullOrWhiteSpace(expected) || string.IsNullOrWhiteSpace(actual)) return false;
        var left = Encoding.UTF8.GetBytes(expected.Trim());
        var right = Encoding.UTF8.GetBytes(actual.Trim());
        return left.Length == right.Length && CryptographicOperations.FixedTimeEquals(left, right);
    }
}

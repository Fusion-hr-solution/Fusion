using System.Text.Json;

namespace EY.HRPlatform.Performance.Domain.Settings;

public enum PlanAlignmentPolicy
{
    EveryObjectiveConnected = 0,
    AtLeastOneConnected = 1,
    Optional = 2,
}

public static class PlanAlignmentSnapshots
{
    public static PlanAlignmentPolicy Read(string settingsJson)
    {
        using var document = JsonDocument.Parse(settingsJson);
        var root = document.RootElement;
        if (root.TryGetProperty("PlanAlignmentPolicy", out var policy))
        {
            if (policy.ValueKind == JsonValueKind.Number && policy.TryGetInt32(out var value)
                && Enum.IsDefined((PlanAlignmentPolicy)value)) return (PlanAlignmentPolicy)value;
            if (policy.ValueKind == JsonValueKind.String && Enum.TryParse<PlanAlignmentPolicy>(policy.GetString(), out var parsed)
                && Enum.IsDefined(parsed)) return parsed;
            throw new InvalidOperationException("The captured plan alignment policy is invalid.");
        }
        // Older activations captured the original standalone toggle. Never read live tenant settings.
        return root.TryGetProperty("AllowStandaloneObjectives", out var legacy) && legacy.ValueKind == JsonValueKind.False
            ? PlanAlignmentPolicy.EveryObjectiveConnected
            : PlanAlignmentPolicy.AtLeastOneConnected;
    }
}

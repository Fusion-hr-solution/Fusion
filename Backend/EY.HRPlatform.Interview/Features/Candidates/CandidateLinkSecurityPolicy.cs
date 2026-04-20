namespace EY.HRPlatform.Interview.Features.Candidates;

internal static class CandidateLinkSecurityPolicy
{
    public const int DefaultLinkValidForValue = 7;
    public const string DefaultLinkValidForUnit = "days";
    public const int DefaultGracePeriodValue = 30;
    public const string DefaultGracePeriodUnit = "minutes";

    public const int MaxLinkValidityHours = 720;
    public const int MaxGracePeriodHours = 168;

    public static string NormalizeLinkValidityUnit(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return normalized switch
        {
            "days" or "hours" or "minutes" => normalized,
            _ => throw new ArgumentException("linkValidForUnit must be one of: days, hours, minutes.", nameof(value)),
        };
    }

    public static string NormalizeGracePeriodUnit(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return normalized switch
        {
            "minutes" or "hours" => normalized,
            _ => throw new ArgumentException("gracePeriodUnit must be one of: minutes, hours.", nameof(value)),
        };
    }

    public static TimeSpan ToLinkValidityDuration(int value, string unit)
    {
        return unit switch
        {
            "days" => TimeSpan.FromDays(value),
            "hours" => TimeSpan.FromHours(value),
            "minutes" => TimeSpan.FromMinutes(value),
            _ => throw new ArgumentException("Unsupported link-validity unit.", nameof(unit)),
        };
    }

    public static TimeSpan ToGracePeriodDuration(int value, string unit)
    {
        return unit switch
        {
            "hours" => TimeSpan.FromHours(value),
            "minutes" => TimeSpan.FromMinutes(value),
            _ => throw new ArgumentException("Unsupported grace-period unit.", nameof(unit)),
        };
    }

    public static int ToRoundedHours(TimeSpan value)
    {
        var rounded = (int)Math.Ceiling(value.TotalHours);
        return Math.Max(1, rounded);
    }

    public static string BuildSecurityLevel(
        bool singleUseLinkEnabled,
        bool emailVerificationEnabled,
        bool ipLockEnabled,
        bool browserFingerprintEnabled)
    {
        var score = 0;

        if (singleUseLinkEnabled)
        {
            score += 1;
        }

        if (emailVerificationEnabled)
        {
            score += 1;
        }

        if (ipLockEnabled)
        {
            score += 1;
        }

        if (browserFingerprintEnabled)
        {
            score += 1;
        }

        return score switch
        {
            >= 3 => "High",
            2 => "Medium",
            _ => "Low",
        };
    }
}

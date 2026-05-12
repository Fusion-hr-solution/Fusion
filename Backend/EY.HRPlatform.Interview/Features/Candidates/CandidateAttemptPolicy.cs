namespace EY.HRPlatform.Interview.Features.Candidates;

internal static class CandidateAttemptPolicy
{
    public const int DefaultMaxAttempts = 0;

    public static int ResolveEffectiveMaxAttempts(int? testOverride, int? globalDefault)
    {
        var normalizedDefault = globalDefault ?? DefaultMaxAttempts;
        return testOverride ?? normalizedDefault;
    }

    public static bool IsLimitReached(int maxAttempts, int attemptCount)
    {
        return maxAttempts > 0 && attemptCount >= maxAttempts;
    }
}

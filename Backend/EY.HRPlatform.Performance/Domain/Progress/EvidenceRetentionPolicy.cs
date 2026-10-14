namespace EY.HRPlatform.Performance.Domain.Progress;

public static class EvidenceRetentionPolicy
{
    public static bool IsExpired(DateTime closedAt, int retentionMonths, DateTime now)
    {
        if (retentionMonths <= 0) throw new ArgumentOutOfRangeException(nameof(retentionMonths));
        DateTime expiresAt;
        try
        {
            expiresAt = closedAt.AddMonths(retentionMonths);
        }
        catch (ArgumentOutOfRangeException)
        {
            return false;
        }

        return now >= expiresAt;
    }
}

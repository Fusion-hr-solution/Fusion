using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// The one definition of "a campaign a sweep should still act on".
/// </summary>
/// <remarks>
/// A closed campaign generates no reminders, no nudges, and no notifications: its work is settled and
/// nobody can act on it any more. Expressing this once means the swept volume per tick is bounded by
/// open campaigns rather than growing with every cycle the tenant has ever run — and a new sweep gets
/// the rule by using this instead of remembering it.
/// </remarks>
public static class OpenCampaignScope
{
    /// <summary>Campaigns that are still open — launched and not yet closed.</summary>
    public static IQueryable<PerformanceCycle> OpenOnly(this IQueryable<PerformanceCycle> campaigns)
        => campaigns.Where(campaign => campaign.Status == PerformanceCycleStatus.Launched);
}

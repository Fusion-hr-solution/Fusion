namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed record CampaignDraftCompleteness(bool IsComplete, IReadOnlyList<string> BlockingReasons)
{
    public static CampaignDraftCompleteness Complete { get; } = new(true, []);

    public static CampaignDraftCompleteness Blocked(IReadOnlyList<string> reasons)
        => new(false, reasons);
}

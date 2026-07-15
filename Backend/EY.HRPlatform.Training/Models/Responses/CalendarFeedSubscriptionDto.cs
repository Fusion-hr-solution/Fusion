namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>The one-time reveal of a learner's calendar feed subscription URL after issue/rotate.</summary>
public class CalendarFeedSubscriptionDto
{
    /// <summary>The opaque feed token (shown once; only its hash is stored server-side).</summary>
    public string Token { get; set; } = string.Empty;
    public string FeedUrl { get; set; } = string.Empty;
    public string WebcalUrl { get; set; } = string.Empty;
}

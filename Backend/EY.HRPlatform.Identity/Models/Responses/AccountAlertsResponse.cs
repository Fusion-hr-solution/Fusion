namespace EY.HRPlatform.Identity.Models.Responses;

/// <summary>The person's choices for new notifications: pop-ups while Fusion is open, and a chime with each.</summary>
public sealed record AccountAlertsResponse(bool Popups, bool Sound);

namespace EY.HRPlatform.Identity.Features.WorkforceAccounts;

public sealed class WorkforceInvitationEmailOptions
{
    public bool Enabled { get; set; }
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string FromEmail { get; set; } = "no-reply@fusion.local";

    /// <summary>`Fusion` is the visible identity; the subject and body come from the
    /// canonical renderer, so this is only the transport display name.</summary>
    public string FromName { get; set; } = "Fusion";

    public string? ReplyToEmail { get; set; }
}

namespace EY.HRPlatform.Identity.Infrastructure.Services;

public sealed class WorkforceInvitationEmailOptions
{
    public const string SectionName = "Email:WorkforceInvitations";

    public bool Enabled { get; set; }
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool UseSsl { get; set; } = true;
    public string FromEmail { get; set; } = "no-reply@example.com";
    public string FromName { get; set; } = "Fusion HR";
    public string? ReplyToEmail { get; set; }
    public string Subject { get; set; } = "Your Fusion workspace invitation";
    public bool UseHtmlBody { get; set; } = true;
}
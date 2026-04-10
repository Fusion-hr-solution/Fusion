namespace EY.HRPlatform.Interview.Features.Candidates;

public class CandidateInvitationEmailOptions
{
    public bool Enabled { get; set; }
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string FromEmail { get; set; } = "no-reply@example.com";
    public string FromName { get; set; } = "EY HR Platform";
    public string? ReplyToEmail { get; set; }
    public bool UseHtmlBody { get; set; } = true;
    public string Subject { get; set; } = "Interview invitation";
}
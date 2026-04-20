namespace EY.HRPlatform.Interview.Models.Candidates;

public class CandidateLinkSecurityStateDto
{
    public string TestId { get; set; } = string.Empty;
    public string TestTitle { get; set; } = string.Empty;
    public CandidateLinkSecuritySettingsDto Settings { get; set; } = new();
    public CandidateLinkPreviewDto Preview { get; set; } = new();
}

public class CandidateLinkSecuritySettingsDto
{
    public bool SingleUseLinkEnabled { get; set; }
    public bool EmailVerificationEnabled { get; set; }
    public bool IpLockEnabled { get; set; }
    public bool BrowserFingerprintEnabled { get; set; }

    public int LinkValidForValue { get; set; }
    public string LinkValidForUnit { get; set; } = "days";

    public int GracePeriodValue { get; set; }
    public string GracePeriodUnit { get; set; } = "minutes";
}

public class CandidateLinkPreviewDto
{
    public bool HasInvitation { get; set; }
    public string? InvitationId { get; set; }
    public string? InviteLink { get; set; }
    public int OpensCount { get; set; }
    public int? AllowedUses { get; set; }
    public string? TokenExpiresAtUtc { get; set; }
    public string SecurityLevel { get; set; } = "Low";
}

public class UpdateCandidateLinkSecuritySettingsDto
{
    public string TestId { get; set; } = string.Empty;

    public bool SingleUseLinkEnabled { get; set; }
    public bool EmailVerificationEnabled { get; set; }
    public bool IpLockEnabled { get; set; }
    public bool BrowserFingerprintEnabled { get; set; }

    public int LinkValidForValue { get; set; } = 7;
    public string LinkValidForUnit { get; set; } = "days";

    public int GracePeriodValue { get; set; } = 30;
    public string GracePeriodUnit { get; set; } = "minutes";
}

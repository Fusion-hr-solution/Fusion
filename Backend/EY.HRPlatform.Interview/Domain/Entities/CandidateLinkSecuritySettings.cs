using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class CandidateLinkSecuritySettings : AggregateRoot
{
    public Guid TestId { get; set; }

    public bool SingleUseLinkEnabled { get; set; } = true;
    public bool EmailVerificationEnabled { get; set; } = true;
    public bool IpLockEnabled { get; set; }
    public bool BrowserFingerprintEnabled { get; set; }

    public int LinkValidForValue { get; set; } = 7;
    public string LinkValidForUnit { get; set; } = "days";

    public int GracePeriodValue { get; set; } = 30;
    public string GracePeriodUnit { get; set; } = "minutes";

    public Test? Test { get; set; }
}

namespace EY.HRPlatform.SharedKernel.Notifications;

// The internal contract a module asks Identity before it emails (B-002 N12): each recipient's account language and the
// company's name and time zone. Identity owns all three; no module keeps a copy that would go stale.

public sealed record NotificationAudienceRequest(Guid TenantId, IReadOnlyList<Guid> EmployeeIds)
{
    public const int MaxEmployees = 100;
}

/// <summary><paramref name="Language"/> is the person's choice, else the company's language, else English.</summary>
public sealed record NotificationRecipientLanguage(Guid EmployeeId, string Language);

/// <summary>Employees without an account get the company's language.</summary>
public sealed record NotificationAudience(string TenantName, string TimeZone, string Language,
    IReadOnlyList<NotificationRecipientLanguage> Recipients)
{
    public string LanguageOf(Guid employeeId)
        => Recipients.FirstOrDefault(recipient => recipient.EmployeeId == employeeId)?.Language ?? Language;
}

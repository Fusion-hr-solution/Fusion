using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

public class CandidatePrivacyAction : AggregateRoot
{
    public Guid TestId { get; set; }
    public Guid InvitationId { get; set; }
    public string ActionType { get; set; } = "Anonymize";
    public string TriggerSource { get; set; } = "UI";
    public string AdminId { get; set; } = string.Empty;
    public string CandidateEmailHash { get; set; } = string.Empty;
    public string CandidateAliasEmail { get; set; } = string.Empty;
    public string CandidateAliasName { get; set; } = string.Empty;
    public int InvitationsUpdated { get; set; }
    public int AttemptsUpdated { get; set; }
    public int EventsUpdated { get; set; }

    public void SetCreatedAt(DateTime createdAt)
    {
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public void SetUpdatedAt(DateTime updatedAt)
    {
        UpdatedAt = updatedAt;
    }
}

using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Training.Domain.Entities;

/// <summary>
/// Feedback a Trainer gives about the group they trained, per in-person Session (US-8.1.3).
/// Authored only by the session's internal trainer (TrainerEmployeeId); admin-visible only.
/// One per (session, trainer).
/// </summary>
public class TrainerGroupFeedback : BaseEntity
{
    public Guid SessionId { get; private set; }
    public TrainingSession Session { get; private set; } = null!;

    public Guid TrainerEmployeeId { get; private set; }

    public int GroupEngagement { get; private set; }
    public int KnowledgeLevel { get; private set; }
    public string? Comments { get; private set; }
    public string? PrerequisiteSuggestions { get; private set; }
    public DateTime SubmittedAt { get; private set; }

    private TrainerGroupFeedback() { }

    public TrainerGroupFeedback(
        Guid sessionId,
        Guid trainerEmployeeId,
        int groupEngagement,
        int knowledgeLevel,
        string? comments,
        string? prerequisiteSuggestions)
    {
        SessionId = sessionId;
        TrainerEmployeeId = trainerEmployeeId;
        GroupEngagement = groupEngagement;
        KnowledgeLevel = knowledgeLevel;
        Comments = comments;
        PrerequisiteSuggestions = prerequisiteSuggestions;
        SubmittedAt = DateTime.UtcNow;
    }
}

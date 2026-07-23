using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Events;

public sealed record EvaluationRoundLaunchedEvent(
    Guid TenantId,
    Guid RoundId,
    Guid CampaignId,
    string RoundName,
    DateTime? SelfAssessmentDeadline,
    DateTime ManagerAssessmentDeadline,
    IReadOnlyList<EvaluationRoundLaunchRecipient> Recipients) : DomainEventBase;

public sealed record EvaluationRoundLaunchRecipient(
    Guid ParticipantEmployeeId,
    string ParticipantName,
    Guid ReviewerEmployeeId,
    string ReviewerName);

public sealed record EvaluationRoundDeadlineExtendedEvent(
    Guid TenantId,
    Guid RoundId,
    Guid CampaignId,
    string RoundName,
    EvaluationDeadlineKind DeadlineKind,
    DateTime PreviousDeadline,
    DateTime NewDeadline,
    string Reason) : DomainEventBase;

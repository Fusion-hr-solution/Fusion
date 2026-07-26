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

/// <summary>Raised when an employee submits their self-assessment; notifies the frozen reviewer.</summary>
public sealed record EvaluationSelfAssessmentSubmittedEvent(
    Guid TenantId,
    Guid RoundId,
    Guid SelfAssignmentId,
    Guid ParticipantEmployeeId,
    string ParticipantName,
    Guid ReviewerEmployeeId,
    string ReviewerName) : DomainEventBase;

/// <summary>Raised when a submitted self-assessment is reopened; notifies the employee.</summary>
public sealed record EvaluationSelfAssessmentReopenedEvent(
    Guid TenantId,
    Guid RoundId,
    Guid SelfAssignmentId,
    Guid ParticipantEmployeeId,
    string ParticipantName,
    string Reason) : DomainEventBase;

/// <summary>Raised when an evaluation is finalized; notifies the employee with the result.</summary>
public sealed record EvaluationFinalizedEvent(
    Guid TenantId,
    Guid RoundId,
    Guid ManagerAssignmentId,
    Guid ParticipantEmployeeId,
    string ParticipantName,
    Guid ReviewerEmployeeId,
    string ReviewerName,
    decimal FinalScore,
    int FinalRatingOrdinal) : DomainEventBase;

/// <summary>Raised when an employee acknowledges a finalized evaluation; notifies the reviewer.</summary>
public sealed record EvaluationAcknowledgedEvent(
    Guid TenantId,
    Guid RoundId,
    Guid ManagerAssignmentId,
    Guid ParticipantEmployeeId,
    string ParticipantName,
    Guid ReviewerEmployeeId,
    string ReviewerName) : DomainEventBase;

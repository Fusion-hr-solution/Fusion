using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Features.Exceptions.Dtos;

public sealed record ExceptionCaseDto(
    Guid Id,
    Guid CycleId,
    Guid SourceWorkItemId,
    string SourceWorkItemType,
    Guid SourceObjectId,
    Guid CurrentOwnerEmployeeId,
    string Status,
    string FrozenReason,
    string FailureCode,
    DateTime OpenedAt,
    DateTime? ResolvedAt,
    Guid? CurrentResolutionWorkItemId,
    Guid? PreviousCaseId,
    string? ResolutionAction);

public sealed record ExceptionCaseHistoryDto(
    Guid Id,
    string AttemptType,
    Guid? FromOwnerEmployeeId,
    Guid? ToOwnerEmployeeId,
    string? Action,
    Guid ActorEmployeeId,
    string Reason,
    string Outcome,
    DateTime OccurredAt);

public sealed record ResolveExceptionCaseRequest(
    ExceptionResolutionAction Action,
    string Reason,
    Guid? ReassignToEmployeeId = null);

public sealed record TransferExceptionOwnershipRequest(
    Guid NewOwnerEmployeeId,
    string Reason);

public sealed record ForceCloseExceptionDecisionRequest(
    Guid ExceptionCaseId,
    ExceptionResolutionAction Action,
    string Reason);

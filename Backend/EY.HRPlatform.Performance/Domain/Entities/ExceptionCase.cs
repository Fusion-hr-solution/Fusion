using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public sealed class ExceptionCase : AggregateRoot, ITenantEntity
{
    private readonly List<ExceptionCaseHistoryEntry> _historyEntries = [];

    private ExceptionCase() { }

    public Guid TenantId { get; private set; }
    public uint Version { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid SourceWorkItemId { get; private set; }
    public CampaignWorkItemType SourceWorkItemType { get; private set; }
    public Guid SourceObjectId { get; private set; }
    public Guid CurrentOwnerEmployeeId { get; private set; }
    public ExceptionCaseStatus Status { get; private set; }
    public DateTime OpenedAt { get; private set; }
    public DateTime? ResolvedAt { get; private set; }
    public string FrozenReason { get; private set; } = string.Empty;
    public string FailureCode { get; private set; } = string.Empty;
    public string FrozenWorkflowContextJson { get; private set; } = string.Empty;
    public Guid? CurrentResolutionWorkItemId { get; private set; }
    public Guid? PreviousCaseId { get; private set; }
    public ExceptionResolutionAction? ResolutionAction { get; private set; }

    public IReadOnlyCollection<ExceptionCaseHistoryEntry> HistoryEntries => _historyEntries.AsReadOnly();

    public static ExceptionCase Create(
        Guid tenantId,
        Guid cycleId,
        Guid sourceWorkItemId,
        CampaignWorkItemType sourceWorkItemType,
        Guid sourceObjectId,
        Guid currentOwnerEmployeeId,
        string frozenReason,
        string failureCode,
        string frozenWorkflowContextJson,
        DateTime openedAt,
        Guid? previousCaseId = null)
    {
        if (tenantId == Guid.Empty || cycleId == Guid.Empty || sourceWorkItemId == Guid.Empty || sourceObjectId == Guid.Empty || currentOwnerEmployeeId == Guid.Empty)
            throw new ArgumentException("Tenant, cycle, source, and owner are required.");

        return new ExceptionCase
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            SourceWorkItemId = sourceWorkItemId,
            SourceWorkItemType = sourceWorkItemType,
            SourceObjectId = sourceObjectId,
            CurrentOwnerEmployeeId = currentOwnerEmployeeId,
            Status = ExceptionCaseStatus.Open,
            OpenedAt = NormalizeUtc(openedAt),
            FrozenReason = Require(frozenReason, 2000, nameof(frozenReason)),
            FailureCode = Require(failureCode, 200, nameof(failureCode)),
            FrozenWorkflowContextJson = Require(frozenWorkflowContextJson, 8000, nameof(frozenWorkflowContextJson)),
            PreviousCaseId = previousCaseId
        };
    }

    public bool MatchesEpisode(Guid sourceWorkItemId, Guid sourceObjectId, string failureCode)
        => SourceWorkItemId == sourceWorkItemId
            && SourceObjectId == sourceObjectId
            && string.Equals(FailureCode, failureCode, StringComparison.Ordinal);

    public void AttachResolutionWorkItem(Guid workItemId)
    {
        if (Status != ExceptionCaseStatus.Open)
            throw new DomainRuleViolationException("Only an open exception case can attach a resolution work item.");

        CurrentResolutionWorkItemId = workItemId == Guid.Empty
            ? throw new ArgumentException("A resolution work item id is required.", nameof(workItemId))
            : workItemId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ClearResolutionWorkItem()
    {
        CurrentResolutionWorkItemId = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordDetection(Guid actorEmployeeId, string reason, string outcome, DateTime occurredAt)
        => UpdatedAt = DateTime.UtcNow;

    public void TransferOwnership(Guid newOwnerEmployeeId, Guid actorEmployeeId, string reason, DateTime occurredAt)
    {
        EnsureOpen();
        if (newOwnerEmployeeId == Guid.Empty || actorEmployeeId == Guid.Empty)
            throw new ArgumentException("A valid owner and actor are required.");
        if (newOwnerEmployeeId == CurrentOwnerEmployeeId)
            throw new DomainRuleViolationException("The new exception owner must differ from the current owner.");

        var previousOwner = CurrentOwnerEmployeeId;
        CurrentOwnerEmployeeId = newOwnerEmployeeId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Resolve(ExceptionResolutionAction action, Guid actorEmployeeId, string reason, DateTime occurredAt)
    {
        EnsureOpen();
        if (action == ExceptionResolutionAction.Transfer)
            throw new DomainRuleViolationException("Transfer is a non-terminal ownership handoff, not a resolution outcome.");

        Status = action switch
        {
            ExceptionResolutionAction.Cancel => ExceptionCaseStatus.Cancelled,
            _ => ExceptionCaseStatus.Resolved
        };
        ResolvedAt = NormalizeUtc(occurredAt);
        ResolutionAction = action;
        UpdatedAt = DateTime.UtcNow;
        CurrentResolutionWorkItemId = null;
    }

    public void ForceClose(ExceptionResolutionAction action, Guid actorEmployeeId, string reason, DateTime occurredAt)
    {
        EnsureOpen();
        if (action is not (ExceptionResolutionAction.Override or ExceptionResolutionAction.Cancel))
            throw new DomainRuleViolationException("Force-close requires either Override or Cancel.");

        Status = ExceptionCaseStatus.ForceClosed;
        ResolvedAt = NormalizeUtc(occurredAt);
        ResolutionAction = action;
        UpdatedAt = DateTime.UtcNow;
        CurrentResolutionWorkItemId = null;
    }

    public void AddHistory(
        string attemptType,
        Guid? fromOwnerEmployeeId,
        Guid? toOwnerEmployeeId,
        ExceptionResolutionAction? action,
        Guid actorEmployeeId,
        string reason,
        string outcome,
        DateTime occurredAt)
    {
        var entry = ExceptionCaseHistoryEntry.Create(
            TenantId,
            Id,
            attemptType,
            fromOwnerEmployeeId,
            toOwnerEmployeeId,
            action,
            actorEmployeeId,
            reason,
            outcome,
            occurredAt);
        _historyEntries.Add(entry);
        UpdatedAt = DateTime.UtcNow;
    }

    private void EnsureOpen()
    {
        if (Status != ExceptionCaseStatus.Open)
            throw new DomainRuleViolationException("Closed exception cases are immutable.");
    }

    private static string Require(string value, int maximum, string parameterName)
    {
        var normalized = value.Trim();
        if (normalized.Length == 0 || normalized.Length > maximum)
            throw new ArgumentException($"Value must be between 1 and {maximum} characters.", parameterName);
        return normalized;
    }

    private static DateTime NormalizeUtc(DateTime value)
        => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
}

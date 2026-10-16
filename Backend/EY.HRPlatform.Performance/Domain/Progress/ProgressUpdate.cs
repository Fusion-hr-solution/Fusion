using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Progress;

/// <summary>
/// One append-only progress check-in on an objective: who recorded it, the status they reported, at most
/// one measurement change (a percentage, a numeric actual, or the milestones completed and reopened
/// together), an optional note and optional evidence. Check-ins are never edited or deleted; a mistake is
/// corrected only by a new owner-submitted one. The note is required when a manual percentage decreases, a
/// milestone is reopened, the owner marks the entry a correction, or the status is At risk or Off track —
/// then it is the reason ("What's in the way"). Check-ins recorded before status existed carry none.
/// </summary>
public sealed class ProgressUpdate : PerformanceAggregate
{
    public const int MaxReasonLength = 500;

    private readonly List<EvidenceItem> _evidence = [];
    private readonly List<ProgressMilestoneChange> _milestoneChanges = [];

    private ProgressUpdate() { }

    public Guid ObjectiveId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid AuthorEmployeeId { get; private set; }
    public ProgressEventKind Kind { get; private set; }

    /// <summary>The new value for a percentage or numeric check-in; null otherwise.</summary>
    public decimal? Value { get; private set; }

    /// <summary>The owner's status; null only on check-ins recorded before status existed.</summary>
    public ObjectiveStatus? Status { get; private set; }

    public string? ContextNote { get; private set; }
    public bool IsCorrection { get; private set; }
    public DateTime RecordedAt { get; private set; }

    public IReadOnlyList<EvidenceItem> Evidence => _evidence;
    public IReadOnlyList<ProgressMilestoneChange> MilestoneChanges => _milestoneChanges;

    public static ProgressUpdate RecordPercentage(Guid tenantId, Guid cycleId, Guid objectiveId, Guid author, decimal value,
        ObjectiveStatus status, string? context, bool isCorrection, bool decreased)
    {
        if (value is < 0m or > 100m) throw new ArgumentOutOfRangeException(nameof(value), "Enter a percentage between 0 and 100.");
        RequireContextIf(decreased || isCorrection, context);
        return Create(tenantId, cycleId, objectiveId, author, ProgressEventKind.PercentageSet, value, status, context, isCorrection);
    }

    public static ProgressUpdate RecordNumericActual(Guid tenantId, Guid cycleId, Guid objectiveId, Guid author, decimal actual,
        ObjectiveStatus status, string? context, bool isCorrection)
    {
        RequireContextIf(isCorrection, context);
        return Create(tenantId, cycleId, objectiveId, author, ProgressEventKind.NumericActual, actual, status, context, isCorrection);
    }

    /// <summary>Every milestone completed or reopened in one check-in. Reopening one requires the note.</summary>
    public static ProgressUpdate RecordMilestones(Guid tenantId, Guid cycleId, Guid objectiveId, Guid author,
        IReadOnlyCollection<(Guid MilestoneId, bool Completed)> changes, ObjectiveStatus status, string? context, bool isCorrection)
    {
        if (changes.Count == 0) throw new ArgumentException("Choose at least one milestone to change.", nameof(changes));
        if (changes.Any(change => change.MilestoneId == Guid.Empty))
            throw new ArgumentException("A milestone change requires a milestone.", nameof(changes));
        if (changes.Select(change => change.MilestoneId).Distinct().Count() != changes.Count)
            throw new ArgumentException("Each milestone can change once per update.", nameof(changes));
        RequireContextIf(changes.Any(change => !change.Completed) || isCorrection, context);
        var update = Create(tenantId, cycleId, objectiveId, author, ProgressEventKind.MilestonesChanged, null, status, context, isCorrection);
        foreach (var (milestoneId, completed) in changes)
        {
            var change = ProgressMilestoneChange.Create(tenantId, milestoneId, completed);
            change.AttachTo(update.Id);
            update._milestoneChanges.Add(change);
        }
        return update;
    }

    /// <summary>A check-in that reports status alone, changing no measurement.</summary>
    public static ProgressUpdate RecordStatusOnly(Guid tenantId, Guid cycleId, Guid objectiveId, Guid author,
        ObjectiveStatus status, string? context)
        => Create(tenantId, cycleId, objectiveId, author, ProgressEventKind.StatusOnly, null, status, context, false);

    public void AttachEvidence(EvidenceItem item)
    {
        ArgumentNullException.ThrowIfNull(item);
        item.AttachTo(Id);
        _evidence.Add(item);
    }

    private static ProgressUpdate Create(Guid tenantId, Guid cycleId, Guid objectiveId, Guid author, ProgressEventKind kind,
        decimal? value, ObjectiveStatus status, string? context, bool isCorrection)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (objectiveId == Guid.Empty) throw new ArgumentException("An objective is required.", nameof(objectiveId));
        if (author == Guid.Empty) throw new ArgumentException("An author is required.", nameof(author));
        if (!Enum.IsDefined(status)) throw new ArgumentException("Choose how the objective is going.", nameof(status));
        if (context is not null && context.Trim().Length > MaxReasonLength)
            throw new ArgumentException($"Keep the note to {MaxReasonLength} characters.", nameof(context));
        // At risk and Off track carry their reason in the note (D-05).
        if (ObjectiveStatuses.IsRisky(status) && string.IsNullOrWhiteSpace(context))
            throw new ProgressReasonRequiredException();

        return new ProgressUpdate
        {
            TenantId = tenantId,
            CycleId = cycleId,
            ObjectiveId = objectiveId,
            AuthorEmployeeId = author,
            Kind = kind,
            Value = value,
            Status = status,
            ContextNote = string.IsNullOrWhiteSpace(context) ? null : context.Trim(),
            IsCorrection = isCorrection,
            RecordedAt = DateTime.UtcNow,
        };
    }

    private static void RequireContextIf(bool required, string? context)
    {
        if (required && string.IsNullOrWhiteSpace(context))
            throw new ArgumentException("This change requires a short context note.", nameof(context));
    }
}

/// <summary>At risk or Off track was reported without saying what's in the way.</summary>
public sealed class ProgressReasonRequiredException()
    : ArgumentException("Say what's in the way when an objective is at risk or off track.");

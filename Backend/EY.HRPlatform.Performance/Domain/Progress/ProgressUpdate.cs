using EY.HRPlatform.Performance.Domain.Common;

namespace EY.HRPlatform.Performance.Domain.Progress;

/// <summary>
/// One append-only progress update on an objective — who recorded it, what measurement event it
/// carries, an optional context note, and optional evidence. Updates are never edited or deleted; a
/// mistake is corrected only by a new owner-submitted update, and the latest valid update of each
/// kind determines current state (product-spec §27). Context is required in-flow when a manual
/// percentage decreases, a milestone is reopened, or the owner marks the entry a correction.
/// </summary>
public sealed class ProgressUpdate : PerformanceAggregate
{
    private readonly List<EvidenceItem> _evidence = [];

    private ProgressUpdate() { }

    public Guid ObjectiveId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid AuthorEmployeeId { get; private set; }
    public ProgressEventKind Kind { get; private set; }

    /// <summary>The new value for a percentage or numeric event; null for a milestone event.</summary>
    public decimal? Value { get; private set; }

    /// <summary>The affected milestone for a milestone completion/reopen event.</summary>
    public Guid? MilestoneId { get; private set; }

    public string? ContextNote { get; private set; }
    public bool IsCorrection { get; private set; }
    public DateTime RecordedAt { get; private set; }

    public IReadOnlyList<EvidenceItem> Evidence => _evidence;

    public static ProgressUpdate RecordPercentage(Guid tenantId, Guid cycleId, Guid objectiveId, Guid author, decimal value, string? context, bool isCorrection, bool decreased)
    {
        if (value < 0m) throw new ArgumentOutOfRangeException(nameof(value), "A percentage cannot be negative.");
        RequireContextIf(decreased || isCorrection, context);
        return Create(tenantId, cycleId, objectiveId, author, ProgressEventKind.PercentageSet, value, null, context, isCorrection);
    }

    public static ProgressUpdate RecordNumericActual(Guid tenantId, Guid cycleId, Guid objectiveId, Guid author, decimal actual, string? context, bool isCorrection)
    {
        RequireContextIf(isCorrection, context);
        return Create(tenantId, cycleId, objectiveId, author, ProgressEventKind.NumericActual, actual, null, context, isCorrection);
    }

    public static ProgressUpdate RecordMilestone(Guid tenantId, Guid cycleId, Guid objectiveId, Guid author, Guid milestoneId, bool completed, string? context, bool isCorrection)
    {
        if (milestoneId == Guid.Empty) throw new ArgumentException("A milestone event requires a milestone.", nameof(milestoneId));
        // Reopening a completed milestone requires context (product-spec §27).
        RequireContextIf(!completed || isCorrection, context);
        var update = Create(tenantId, cycleId, objectiveId, author,
            completed ? ProgressEventKind.MilestoneCompleted : ProgressEventKind.MilestoneReopened, null, milestoneId, context, isCorrection);
        return update;
    }

    public void AttachEvidence(EvidenceItem item)
    {
        ArgumentNullException.ThrowIfNull(item);
        item.AttachTo(Id);
        _evidence.Add(item);
    }

    private static ProgressUpdate Create(Guid tenantId, Guid cycleId, Guid objectiveId, Guid author, ProgressEventKind kind, decimal? value, Guid? milestoneId, string? context, bool isCorrection)
    {
        if (tenantId == Guid.Empty) throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (objectiveId == Guid.Empty) throw new ArgumentException("An objective is required.", nameof(objectiveId));
        if (author == Guid.Empty) throw new ArgumentException("An author is required.", nameof(author));

        return new ProgressUpdate
        {
            TenantId = tenantId,
            CycleId = cycleId,
            ObjectiveId = objectiveId,
            AuthorEmployeeId = author,
            Kind = kind,
            Value = value,
            MilestoneId = milestoneId,
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

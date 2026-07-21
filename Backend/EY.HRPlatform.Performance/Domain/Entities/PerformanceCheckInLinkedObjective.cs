using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An objective from the participant's Approved plan attached to a check-in — either as planned
/// agenda at creation or as an objective actually discussed at completion (<see cref="WasDiscussed"/>).
/// </summary>
public sealed class PerformanceCheckInLinkedObjective : BaseEntity
{
    private PerformanceCheckInLinkedObjective() { }

    public Guid CheckInId { get; private set; }
    public Guid ObjectiveId { get; private set; }
    public string ObjectiveTitle { get; private set; } = string.Empty;
    public bool WasDiscussed { get; private set; }

    internal static PerformanceCheckInLinkedObjective Create(Guid checkInId, Guid objectiveId, string objectiveTitle)
        => new()
        {
            Id = Guid.NewGuid(),
            CheckInId = checkInId,
            ObjectiveId = objectiveId,
            ObjectiveTitle = (objectiveTitle ?? string.Empty).Trim(),
            WasDiscussed = false
        };

    internal void MarkDiscussed() => WasDiscussed = true;
}

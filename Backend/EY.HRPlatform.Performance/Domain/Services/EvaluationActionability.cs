using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Domain.Services;

/// <summary>
/// The frozen-visibility actionability rule for a manager assignment, shared by
/// authorization handlers and roster projections so server and UI never disagree.
/// A manager assignment is actionable when the round is manager-only, or the
/// participant's self-assessment is submitted, or the frozen self deadline has
/// passed — an absent self-assessment must never block the round.
/// </summary>
public static class EvaluationActionability
{
    public static bool IsManagerActionable(
        EvaluationAssessmentModel model,
        EvaluationAssignmentStatus? selfStatus,
        DateTime? selfDeadline,
        DateTime now)
    {
        if (model == EvaluationAssessmentModel.ManagerOnly)
            return true;
        if (selfStatus is EvaluationAssignmentStatus.Submitted or EvaluationAssignmentStatus.Finalized)
            return true;
        return selfDeadline.HasValue && now > selfDeadline.Value;
    }

    /// <summary>
    /// True when a self-assessment exists, was never submitted, and its deadline has
    /// passed — the "no self-assessment submitted" display state on the comparison surface.
    /// </summary>
    public static bool SelfAssessmentMissing(
        EvaluationAssignmentStatus? selfStatus,
        DateTime? selfDeadline,
        DateTime now)
    {
        if (selfStatus is null)
            return false;
        if (selfStatus is EvaluationAssignmentStatus.Submitted or EvaluationAssignmentStatus.Finalized)
            return false;
        return selfDeadline.HasValue && now > selfDeadline.Value;
    }
}

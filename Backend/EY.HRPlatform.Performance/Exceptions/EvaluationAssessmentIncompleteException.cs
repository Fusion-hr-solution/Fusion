using EY.HRPlatform.Performance.Domain.Entities;

namespace EY.HRPlatform.Performance.Exceptions;

/// <summary>
/// Thrown when a self- or manager-assessment submission fails server-side
/// completeness validation. Carries the exact frozen items still requiring
/// attention so the caller can point the author at them. Maps to HTTP 409 Conflict.
/// </summary>
public sealed class EvaluationAssessmentIncompleteException : Exception
{
    public EvaluationAssessmentIncompleteException(IReadOnlyList<EvaluationAssessmentIncompleteItem> incompleteItems)
        : base($"The assessment cannot be submitted: {incompleteItems.Count} required item(s) are incomplete.")
    {
        IncompleteItems = incompleteItems;
    }

    public IReadOnlyList<EvaluationAssessmentIncompleteItem> IncompleteItems { get; }
}

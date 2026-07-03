using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates;

public sealed record TemplateValidationResult(bool IsValid, IReadOnlyList<string> Errors);

public sealed class TemplateRevisionValidator(PerformanceDbContext db)
{
    /// <summary>
    /// Validates an ObjectiveTemplateRevision for activation.
    /// Checks: content completeness (Quantitative/Qualitative) and policy binding.
    /// </summary>
    /// <param name="revision">The revision to validate.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <param name="forNewActivation">
    /// True for activating a Draft (category must exist and be Active per P1.1 §11.3/§13.3);
    /// false when re-checking an already-activated revision (e.g. restore), where existing
    /// templates retain archived categories and only policy compatibility matters.
    /// </param>
    public async Task<TemplateValidationResult> ValidateForActivationAsync(
        ObjectiveTemplateRevision revision,
        CancellationToken cancellationToken,
        bool forNewActivation = true)
    {
        var errors = new List<string>();

        // Applicability validation state
        if (revision.ApplicabilityValidationState == "HasUnresolved")
            errors.Add("One or more applicability references are invalid.");

        // Primary category is required before activation (P1.1 §13.3); archived
        // categories cannot be selected for new activation (P1.1 §11.3).
        if (forNewActivation)
        {
            if (revision.CategoryId is null)
            {
                errors.Add("A primary category is required before activation.");
            }
            else
            {
                var category = await db.ObjectiveTemplateCategories
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == revision.CategoryId.Value, cancellationToken);

                if (category is null)
                    errors.Add("The selected category no longer exists. Choose another category.");
                else if (category.Status == CategoryStatus.Archived)
                    errors.Add("The selected category is archived and cannot be used for new activation. Choose an active category.");
            }
        }

        // Content validation by measurement method (P1.1 §13.4 / §13.5)
        if (revision.MeasurementType == "Quantitative")
        {
            if (string.IsNullOrWhiteSpace(revision.Indicator))
                errors.Add("Quantitative templates must define the indicator to measure.");
            if (revision.TargetValue is null)
                errors.Add("Quantitative templates must have a target value.");
            if (string.IsNullOrWhiteSpace(revision.Unit))
                errors.Add("Quantitative templates must have a unit.");
        }
        else if (revision.MeasurementType == "Qualitative")
        {
            if (string.IsNullOrWhiteSpace(revision.ExpectedOutcome))
                errors.Add("Qualitative templates must describe the expected outcome.");
            if (string.IsNullOrWhiteSpace(revision.SuccessCriteria))
                errors.Add("Qualitative templates must have success criteria.");
        }

        // Policy binding: must have an Active policy
        var activePolicy = await db.TenantObjectivePolicies
            .Include(p => p.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (activePolicy?.ActiveVersion is null)
        {
            errors.Add("Cannot activate a template without an active objective policy. Publish a policy first.");
            return new TemplateValidationResult(errors.Count == 0, errors);
        }

        // Policy binding: SuggestedWeighting must be in the policy's allowed weights (if set)
        if (revision.SuggestedWeighting is { } weight)
        {
            var allowedWeights = activePolicy.ActiveVersion.AllowedWeightValues
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(w => decimal.TryParse(w, out var v) ? (decimal?)v : null)
                .Where(v => v is not null)
                .Select(v => v!.Value)
                .ToHashSet();

            if (!allowedWeights.Contains(weight))
            {
                errors.Add(
                    $"SuggestedWeighting of {weight}% is not in the active policy's allowed weights " +
                    $"({activePolicy.ActiveVersion.AllowedWeightValues}). Update the weight or the policy.");
            }
        }

        // Policy binding: MeasurementType must be supported by the active policy
        var supportedTypes = activePolicy.ActiveVersion.MeasurementTypes
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (!supportedTypes.Contains(revision.MeasurementType))
        {
            errors.Add(
                $"MeasurementType '{revision.MeasurementType}' is not supported by the active policy " +
                $"({activePolicy.ActiveVersion.MeasurementTypes}).");
        }

        return new TemplateValidationResult(errors.Count == 0, errors);
    }
}

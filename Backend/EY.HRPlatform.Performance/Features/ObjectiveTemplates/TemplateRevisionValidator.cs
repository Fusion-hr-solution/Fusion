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
    public async Task<TemplateValidationResult> ValidateForActivationAsync(
        ObjectiveTemplateRevision revision,
        CancellationToken cancellationToken)
    {
        var errors = new List<string>();

        // Applicability validation state
        if (revision.ApplicabilityValidationState == "HasUnresolved")
            errors.Add("One or more applicability references are invalid.");

        // Content validation
        if (revision.MeasurementType == "Quantitative")
        {
            if (revision.TargetValue is null)
                errors.Add("Quantitative templates must have a target value.");
            if (string.IsNullOrWhiteSpace(revision.Unit))
                errors.Add("Quantitative templates must have a unit.");
        }
        else if (revision.MeasurementType == "Qualitative")
        {
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

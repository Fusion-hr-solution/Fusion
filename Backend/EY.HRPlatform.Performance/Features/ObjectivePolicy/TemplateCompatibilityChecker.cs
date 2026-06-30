using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectivePolicy;

public sealed record TemplateCompatibilityIssue(Guid TemplateId, string TemplateName, string ConflictingField, string Reason);

public sealed class TemplateCompatibilityChecker(PerformanceDbContext db)
{
    /// <summary>
    /// Checks active templates against the proposed policy draft.
    /// Returns the list of templates that would become invalid under the new policy.
    /// </summary>
    public async Task<IReadOnlyList<TemplateCompatibilityIssue>> CheckAsync(
        TenantObjectivePolicyVersion draft,
        CancellationToken cancellationToken)
    {
        var allowedWeights = draft.AllowedWeightValues
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(w => decimal.TryParse(w, out var v) ? (decimal?)v : null)
            .Where(v => v is not null)
            .Select(v => v!.Value)
            .ToHashSet();

        var issues = new List<TemplateCompatibilityIssue>();

        var supportedTypes = draft.MeasurementTypes
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var activeRevisions = await db.ObjectiveTemplateRevisions
            .Where(r =>
                r.Status == ObjectiveTemplateRevisionStatus.Active &&
                r.Template != null &&
                r.Template.Status != ObjectiveTemplateStatus.Archived)
            .Select(r => new
            {
                r.TemplateId,
                r.Title,
                r.MeasurementType,
                r.SuggestedWeighting,
            })
            .ToListAsync(cancellationToken);

        foreach (var revision in activeRevisions)
        {
            if (!supportedTypes.Contains(revision.MeasurementType))
            {
                issues.Add(new TemplateCompatibilityIssue(
                    revision.TemplateId,
                    revision.Title,
                    "MeasurementType",
                    $"MeasurementType '{revision.MeasurementType}' is not supported by the policy ({draft.MeasurementTypes})."));
            }

            if (revision.SuggestedWeighting is { } weight && !allowedWeights.Contains(weight))
            {
                issues.Add(new TemplateCompatibilityIssue(
                    revision.TemplateId,
                    revision.Title,
                    "SuggestedWeighting",
                    $"SuggestedWeighting={weight}% is not in the policy's allowed weights ({draft.AllowedWeightValues})."));
            }
        }

        return issues;
    }
}

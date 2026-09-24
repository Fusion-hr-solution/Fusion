namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

public interface IOrganizationImportMatchReadinessService
{
    OrganizationImportMatchReadiness Evaluate(OrganizationImportMappingPlan plan);
    OrganizationImportMatchCompletionKind CompletionKind(OrganizationImportMappingPlan plan, OrganizationImportMatchReadiness readiness);
}

/// <summary>
/// The sole authority for whether source interpretation is complete. It deliberately consumes
/// only the Mapping Plan: Review issues, semantic-provider lifecycle, and UI state cannot alter
/// the Match/Review boundary.
/// </summary>
public sealed class OrganizationImportMatchReadinessService : IOrganizationImportMatchReadinessService
{
    public OrganizationImportMatchReadiness Evaluate(OrganizationImportMappingPlan plan)
    {
        var required = new List<OrganizationImportRequiredDecision>();
        if (plan.SourceShape == OrganizationImportShape.Unresolved
            || plan.ShapeStatus == OrganizationImportResolutionStatus.Unresolved)
            required.Add(new("shape", OrganizationImportRequiredDecisionKind.SourceShape));

        if (plan.SourceShape == OrganizationImportShape.LevelColumns)
        {
            if (plan.OrderedLevelColumns.Count < 2)
                required.Add(new("levels", OrganizationImportRequiredDecisionKind.FieldMapping));
        }
        else if (plan.SourceShape is OrganizationImportShape.Native or OrganizationImportShape.ParentReference)
        {
            foreach (var field in new[] { OrganizationImportFields.Name, OrganizationImportFields.Type, OrganizationImportFields.ParentBusinessCode })
            {
                var mapping = plan.ColumnMappings.SingleOrDefault(item => item.Field == field);
                if (mapping is null || mapping.ColumnIndex is null || mapping.MatchStatus is OrganizationImportMappingStatus.NeedsReview or OrganizationImportMappingStatus.Suggested)
                    required.Add(new($"field:{field}", OrganizationImportRequiredDecisionKind.FieldMapping, TargetField: field));
            }
        }

        foreach (var mapping in plan.TypeMappingDetails ?? [])
            if (mapping.TypeId is null || mapping.Status is OrganizationImportMappingStatus.NeedsReview or OrganizationImportMappingStatus.Suggested)
                required.Add(new($"type:{mapping.SourceValue}", OrganizationImportRequiredDecisionKind.TypeMapping, mapping.SourceValue));

        if (plan.Identity is null || plan.Identity.Status is OrganizationImportMappingStatus.NeedsReview or OrganizationImportMappingStatus.Suggested)
            required.Add(new("identity", OrganizationImportRequiredDecisionKind.IdentityStrategy));

        foreach (var duplicate in plan.ColumnMappings.Where(mapping => mapping.ColumnIndex is not null)
                     .GroupBy(mapping => mapping.ColumnIndex!.Value).Where(group => group.Count() > 1))
            required.Add(new($"conflict:column:{duplicate.Key}", OrganizationImportRequiredDecisionKind.MappingConflict));

        var distinct = required.DistinctBy(item => item.Key, StringComparer.Ordinal).ToList();
        var complete = distinct.Count == 0;
        return new OrganizationImportMatchReadiness(
            complete ? OrganizationImportMatchReadinessState.Complete : OrganizationImportMatchReadinessState.Incomplete,
            complete,
            distinct,
            complete ? OrganizationImportStage.Review : OrganizationImportStage.Match);
    }

    public OrganizationImportMatchCompletionKind CompletionKind(
        OrganizationImportMappingPlan plan,
        OrganizationImportMatchReadiness readiness)
    {
        if (!readiness.CanContinue) return OrganizationImportMatchCompletionKind.Incomplete;
        var origins = plan.ColumnMappings.Where(mapping => mapping.ColumnIndex is not null).Select(mapping => mapping.Origin)
            .Concat((plan.TypeMappingDetails ?? []).Select(mapping => mapping.Origin))
            .Append(plan.ShapeOrigin)
            .Append(plan.Identity?.Origin ?? OrganizationImportResolutionOrigin.Deterministic);
        return origins.All(origin => origin is OrganizationImportResolutionOrigin.Native or OrganizationImportResolutionOrigin.Deterministic)
            ? OrganizationImportMatchCompletionKind.Automatic
            : OrganizationImportMatchCompletionKind.Confirmed;
    }
}

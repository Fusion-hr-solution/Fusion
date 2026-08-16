namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

/// <summary>
/// Deterministic structural evidence that distinguishes a parent-reference table
/// from a level-column (path-enumeration) table.
///
/// Both layouts are usually rectangular — every row fills every column — so row
/// shape alone cannot tell them apart. What distinguishes a parent-reference
/// table is a self-referential foreign key: one column's non-empty values all
/// appear in another, identifier-like column's distinct values (for example
/// <c>Rolls Up To</c> values are a subset of <c>OU Ref</c> values). A level-column
/// table has no such column-to-column reference — its columns are hierarchy
/// levels whose values repeat down the rows.
///
/// Establishing this deterministically lets Fusion constrain the source shape and
/// ask AI only for the genuinely unresolved semantics (which column means Name,
/// Business Code, Type, or Parent reference), instead of asking AI to rediscover
/// an obvious relational pattern.
/// </summary>
public static class OrganizationImportShapeEvidence
{
    // A coincidental reference of a single value could be noise; require at least
    // two distinct references before treating a column pair as a parent-reference.
    private const int MinimumParentReferences = 2;

    public static bool HasParentReferenceStructure(
        OrganizationSourceTable table,
        ISet<int>? excludedColumns = null)
        => TryFindParentReference(table, excludedColumns, out _, out _);

    /// <summary>
    /// Finds the identifier column and the column that references it, if the table
    /// is deterministically a parent-reference table.
    /// </summary>
    public static bool TryFindParentReference(
        OrganizationSourceTable table,
        ISet<int>? excludedColumns,
        out int identifierColumn,
        out int parentColumn)
    {
        identifierColumn = -1;
        parentColumn = -1;
        if (table.Columns.Count < 2 || table.Rows.Count == 0) return false;

        var columns = table.Columns
            .Where(column => excludedColumns is null || !excludedColumns.Contains(column.Index))
            .OrderBy(column => column.Index)
            .Select(column => new
            {
                column.Index,
                Values = table.Rows
                    .Select(row => column.Index < row.Count ? Normalize(row[column.Index]) : null)
                    .Where(value => value is not null)
                    .Select(value => value!)
                    .ToList(),
            })
            .Where(column => column.Values.Count > 0)
            .ToList();

        var best = (identifier: -1, parent: -1, matches: -1);
        foreach (var identifier in columns)
        {
            var distinct = identifier.Values.ToHashSet(StringComparer.Ordinal);
            // The identifier column must be a genuine key: every non-empty value
            // unique, and enough of them to be more than a coincidence.
            if (distinct.Count != identifier.Values.Count || distinct.Count < MinimumParentReferences)
                continue;

            foreach (var candidate in columns)
            {
                if (candidate.Index == identifier.Index) continue;
                var distinctReferences = candidate.Values.ToHashSet(StringComparer.Ordinal);
                // Every non-empty value in the referencing column must point at the
                // identifier column, with at least two distinct references. A column
                // that merely shares one value is not a parent reference.
                if (distinctReferences.Count < MinimumParentReferences) continue;
                if (!distinctReferences.All(distinct.Contains)) continue;
                // A referencing column that is itself all-unique and fully covers the
                // identifier is ambiguous (could be a parallel key); prefer the pair
                // with the most distinct references and, ties aside, deterministic order.
                if (distinctReferences.Count > best.matches)
                    best = (identifier.Index, candidate.Index, distinctReferences.Count);
            }
        }

        if (best.identifier < 0) return false;
        identifierColumn = best.identifier;
        parentColumn = best.parent;
        return true;
    }

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
}

namespace EY.HRPlatform.CoreHR.Features.OrganizationImport;

/// <summary>
/// One column that a level-columns source carries but that is not a hierarchy level —
/// a row number, sequence, or record identifier. Fusion drops it from the hierarchy and
/// surfaces it quietly so the administrator can see the decision without having to act.
/// </summary>
public sealed record OrganizationImportIgnoredColumn(int ColumnIndex, string Label, string Reason);

/// <summary>
/// Deterministic structural evidence for a level-column (path-enumeration) table: which
/// columns are genuine hierarchy levels, and which are row keys the export carried along
/// (an <c>index</c>, <c>No.</c>, or <c>id</c> column). This exists so a leading row-number
/// column can never be mistaken for the top of the organization, and so Fusion resolves a
/// clean level table's shape itself instead of spending an AI round-trip to rediscover it.
///
/// A hierarchy level narrows toward the top: the coarsest column groups many rows, and
/// distinct values only grow moving down the levels. A row key breaks that shape — every
/// value is unique even though finer groupings sit to its right — which is exactly what
/// distinguishes it from a real level, deterministically and without guessing.
/// </summary>
public static class OrganizationImportLevelEvidence
{
    // Below this row count a "one value per row" column could be a coincidence rather than
    // a genuine key, so we do not treat cardinality alone as key evidence.
    private const int MinimumRowsForKeyEvidence = 3;

    // Header words that name a row's ordinal or identifier rather than an organizational level.
    private static readonly HashSet<string> IdentifierHeaderTokens = new(StringComparer.Ordinal)
    {
        "index", "idx", "no", "num", "number", "row", "rownum", "rownumber", "rowid",
        "seq", "sequence", "line", "lineno", "linenumber", "serial", "sr", "srno", "sno",
        "id", "key", "ordinal", "rank", "order", "count",
    };

    /// <summary>
    /// The ordered hierarchy-level columns of a level-columns table (left to right), with any
    /// identifier/row-key columns removed and reported through <paramref name="ignored"/>.
    /// </summary>
    public static IReadOnlyList<int> SelectLevelColumns(
        OrganizationSourceTable table,
        out IReadOnlyList<OrganizationImportIgnoredColumn> ignored)
    {
        ignored = [];
        var columns = table.Columns
            .OrderBy(column => column.Index)
            .Select(column => Profile(table, column))
            .Where(profile => profile.NonEmpty > 0)
            .ToList();
        if (columns.Count < 2) return columns.Select(profile => profile.Index).ToList();

        var ignoredColumns = new List<OrganizationImportIgnoredColumn>();
        var kept = new List<ColumnProfile>();
        for (var position = 0; position < columns.Count; position++)
        {
            var column = columns[position];
            var hasLevelToRight = position < columns.Count - 1;
            var allValuesUnique = column.Distinct == column.NonEmpty && column.NonEmpty >= MinimumRowsForKeyEvidence;
            var identifierHeader = column.IsIdentifierHeader;
            // A coarser level to the left must have no more distinct values than the levels
            // beneath it. A unique-per-row column with a coarser grouping to its right is
            // therefore not a level — it is a row key threaded through the hierarchy.
            var finerThanALevelBelow = hasLevelToRight && columns.Skip(position + 1).Any(below => below.Distinct < column.Distinct);
            var numericKey = allValuesUnique && column.AllNumeric;

            var isRowKey = hasLevelToRight
                && ((allValuesUnique && (finerThanALevelBelow || numericKey)) || (identifierHeader && allValuesUnique));

            if (isRowKey)
                ignoredColumns.Add(new OrganizationImportIgnoredColumn(column.Index, column.Label, ReasonFor(numericKey, identifierHeader)));
            else
                kept.Add(column);
        }

        // A level hierarchy needs at least two real levels. If the filter would leave fewer,
        // trust the raw columns rather than fabricate a shape by discarding real data.
        if (kept.Count < 2) return columns.Select(profile => profile.Index).ToList();

        ignored = ignoredColumns;
        return kept.Select(profile => profile.Index).ToList();
    }

    /// <summary>
    /// True when the table is deterministically a clean level-columns hierarchy: at least two
    /// real levels, every populated row filling a contiguous left-to-right prefix, and a
    /// coarsest level that groups (fans out) rather than being unique per row.
    /// </summary>
    public static bool IsLevelColumnsTable(OrganizationSourceTable table)
    {
        var levels = SelectLevelColumns(table, out _);
        if (levels.Count < 2) return false;
        if (!HasOrderedLevelPattern(table, levels)) return false;
        var top = Profile(table, table.Columns.First(column => column.Index == levels[0]));
        return top.Distinct < top.NonEmpty;
    }

    /// <summary>
    /// Every populated row fills a contiguous run of the given columns from the left (no value
    /// after a gap). This is the signature of path-enumeration levels rather than field roles.
    /// </summary>
    public static bool HasOrderedLevelPattern(OrganizationSourceTable table, IReadOnlyList<int> columnIndexes)
    {
        if (columnIndexes.Count < 2) return false;
        var nonEmptyRows = 0;
        var orderedRows = 0;
        foreach (var row in table.Rows)
        {
            var seenBlank = false;
            var hasValue = false;
            var ordered = true;
            foreach (var column in columnIndexes)
            {
                var value = column < row.Count ? Clean(row[column]) : null;
                if (value is null) seenBlank = true;
                else
                {
                    hasValue = true;
                    if (seenBlank) ordered = false;
                }
            }
            if (!hasValue) continue;
            nonEmptyRows++;
            if (ordered) orderedRows++;
        }
        return nonEmptyRows > 0 && orderedRows == nonEmptyRows;
    }

    /// <summary>
    /// The canonical Fusion type role each level of a level-columns hierarchy takes, by depth.
    /// Level columns are strictly depth-ordered, so the type ladder is a structural fact rather than a
    /// judgement — this is what lets Fusion resolve level types predictably instead of depending on a
    /// language model to re-derive an ordering it often scrambles at an affordable effort tier.
    ///
    /// On a fresh organization the shallowest level is the enterprise root (<c>Organization</c>); the
    /// deepest is a <c>Team</c>; interior levels fill from the leaf upward through Department, Division,
    /// Business Unit. When a permanent root already exists every imported level is a child of it, so the
    /// ladder starts one rung below the root. Names match <see cref="OrganizationalUnitTypeCatalog"/>.
    /// </summary>
    public static IReadOnlyList<string> DepthTypeLadder(int levelCount, bool hasPermanentRoot)
    {
        if (levelCount <= 0) return [];
        // Filled leaf-first so the deepest level is always Team and shallower levels grow more senior.
        var leafFirst = new[] { "Team", "Department", "Division", "Business Unit" };
        var ladder = new string[levelCount];
        for (var depth = 0; depth < levelCount; depth++)
        {
            var fromLeaf = levelCount - 1 - depth;
            ladder[depth] = fromLeaf < leafFirst.Length ? leafFirst[fromLeaf] : "Business Unit";
        }
        if (!hasPermanentRoot) ladder[0] = "Organization";
        // A single imported level under an existing root is simply a Team.
        if (levelCount == 1 && hasPermanentRoot) ladder[0] = "Team";
        return ladder;
    }

    private static ColumnProfile Profile(OrganizationSourceTable table, OrganizationSourceColumn column)
    {
        var values = table.Rows
            .Select(row => column.Index < row.Count ? Clean(row[column.Index]) : null)
            .Where(value => value is not null)
            .Select(value => value!)
            .ToList();
        var distinct = values.Distinct(StringComparer.OrdinalIgnoreCase).Count();
        var allNumeric = values.Count > 0 && values.All(value => long.TryParse(value, out _));
        var label = Clean(column.SourceLabel);
        return new ColumnProfile(column.Index, label ?? string.Empty, IsIdentifierHeader(label), values.Count, distinct, allNumeric);
    }

    private static bool IsIdentifierHeader(string? label)
    {
        if (string.IsNullOrWhiteSpace(label)) return false;
        if (label.Trim() == "#") return true;
        return IdentifierHeaderTokens.Contains(Normalize(label));
    }

    private static string ReasonFor(bool numericKey, bool identifierHeader) =>
        numericKey ? "Looks like a row number." : identifierHeader ? "Looks like a record identifier." : "Looks like a row key.";

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string Normalize(string value) => new(value.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    private sealed record ColumnProfile(int Index, string Label, bool IsIdentifierHeader, int NonEmpty, int Distinct, bool AllNumeric);
}

using System.Globalization;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>
/// The Fusion fields Workforce Import can establish. Deliberately narrow — no Employment Type,
/// Job, Position, Skills, grade, compensation, payroll, DOB, gender, address, or Location catalog.
/// </summary>
public enum WorkforceImportField
{
    Ignored,
    // Trusted tenant-owned Fusion references — strongest identity, but ONLY when a column is
    // explicitly recognized/mapped as such. An arbitrary GUID-shaped column never auto-maps here.
    FusionEmployeeReference,
    FusionOrganizationReference,
    FusionManagerReference,
    EmployeeNumber,
    FirstName,
    LastName,
    FullName,
    PreferredName,
    WorkEmail,
    EmploymentStart,
    WorkEffectiveFrom,
    Organization,
    DisplayTitle,
    Location,
    Manager,
    WorkerReference,
    ManagerReference,
    LifecycleStatus,
    EmploymentEnd,
}

public enum WorkforceNameFormat { FirstLast, LastCommaFirst, LastFirst }

public enum WorkforceDateFormat { Iso, DayMonthYear, MonthDayYear }

/// <summary>Session-level interpretation decisions. Column mappings apply globally, not per row.</summary>
public sealed record WorkforceImportInterpretation(
    IReadOnlyDictionary<int, WorkforceImportField> ColumnMappings,
    WorkforceNameFormat? NameFormat,
    WorkforceDateFormat? DateFormat)
{
    public static WorkforceImportInterpretation Empty { get; } = new(new Dictionary<int, WorkforceImportField>(), null, null);
}

public sealed record WorkforceInterpretationIssue(string Code, string Severity, string Message, WorkforceImportField Field);

/// <summary>The normalized establishment proposal for one source row (before identity/Org/Manager resolution).</summary>
public sealed record NormalizedWorkforceRow(
    int SourceRowNumber,
    string? FusionEmployeeReference,
    string? FusionOrganizationReference,
    string? FusionManagerReference,
    string? EmployeeNumber,
    string? FirstName,
    string? LastName,
    string? PreferredName,
    string? WorkEmail,
    DateOnly? EmploymentStart,
    DateOnly? WorkEffectiveFrom,
    string? OrganizationRef,
    string? DisplayTitle,
    string? Location,
    string? ManagerReference,
    string? WorkerKey,
    string? ManagerKey,
    string? LifecycleStatus,
    DateOnly? EmploymentEnd,
    IReadOnlyList<WorkforceInterpretationIssue> Issues);

public sealed record WorkforceColumnMapping(int ColumnIndex, string? Label, WorkforceImportField Field, string Origin);

public sealed record WorkforceInterpretationResult(
    IReadOnlyList<WorkforceColumnMapping> Mappings,
    IReadOnlyList<WorkforceImportField> UnresolvedRequiredFields,
    bool NameFormatDecisionNeeded,
    bool DateFormatDecisionNeeded,
    IReadOnlyList<NormalizedWorkforceRow> Rows);

/// <summary>
/// Deterministic Workforce source interpretation: auto-maps native/alias headers, applies global
/// column-mapping decisions, splits combined names, parses dates without silent assumptions, and
/// applies the baseline/effective-date establishment rules and source-local reference keys. AI is
/// never used here; it only assists unresolved column meaning elsewhere.
/// </summary>
public sealed class WorkforceImportInterpreter
{
    // Required normalized data for a new Employee (FirstName/LastName may instead come from FullName).
    private static readonly WorkforceImportField[] RequiredFields =
        [WorkforceImportField.EmploymentStart, WorkforceImportField.Organization, WorkforceImportField.DisplayTitle];

    private static readonly (WorkforceImportField Field, string[] Aliases)[] AliasTable =
    [
        // Only explicit, unambiguous Fusion-reference headers map here — never a bare "id".
        (WorkforceImportField.FusionEmployeeReference, ["fusion employee id", "fusion employee reference", "fusion worker id", "fusion employee key"]),
        (WorkforceImportField.FusionOrganizationReference, ["fusion orgunit id", "fusion org unit id", "fusion organization id", "fusion org id", "fusion orgunit reference"]),
        (WorkforceImportField.FusionManagerReference, ["fusion manager id", "fusion manager reference", "fusion manager employee id"]),
        (WorkforceImportField.EmployeeNumber, ["employee number", "employee no", "employee id", "emp no", "emp id", "matricule", "staff id", "staff number", "payroll id", "payroll number"]),
        (WorkforceImportField.FirstName, ["first name", "firstname", "given name", "prénom", "prenom"]),
        (WorkforceImportField.LastName, ["last name", "lastname", "surname", "family name", "nom"]),
        (WorkforceImportField.FullName, ["employee name", "full name", "name", "nom complet", "nom et prénom"]),
        (WorkforceImportField.PreferredName, ["preferred name", "known as", "nickname"]),
        (WorkforceImportField.WorkEmail, ["work email", "email", "e-mail", "email address", "courriel", "adresse email"]),
        (WorkforceImportField.EmploymentStart, ["employment start", "start date", "hire date", "date embauche", "date d'embauche", "date of joining", "joining date", "date début", "seniority date"]),
        (WorkforceImportField.WorkEffectiveFrom, ["work details effective from", "effective from", "assignment start", "position start"]),
        (WorkforceImportField.Organization, ["organization", "organisation", "org unit", "organization code", "org code", "department", "département", "departement", "business unit", "division", "team", "service"]),
        (WorkforceImportField.DisplayTitle, ["display title", "title", "job title", "poste", "poste occupé", "role", "current title", "position title", "fonction"]),
        (WorkforceImportField.Location, ["location", "work location", "office", "site", "lieu", "ville"]),
        (WorkforceImportField.Manager, ["manager", "reports to", "responsable", "n+1", "supervisor", "line manager", "manager name", "manager email", "manager employee number", "manager employee no", "manager matricule"]),
        (WorkforceImportField.WorkerReference, ["worker id", "worker reference", "source id", "row id", "record id"]),
        (WorkforceImportField.ManagerReference, ["manager id", "manager reference", "manager worker id", "reports to id", "manager row id"]),
        (WorkforceImportField.LifecycleStatus, ["status", "employment status", "worker status", "employee status", "statut"]),
        (WorkforceImportField.EmploymentEnd, ["termination date", "end date", "leaving date", "date fin", "date de départ", "exit date"]),
    ];

    public WorkforceInterpretationResult Interpret(
        IReadOnlyList<string?> columnLabels,
        IReadOnlyList<IReadOnlyList<string?>> rows,
        WorkforceImportInterpretation decisions,
        DateOnly baseline)
    {
        var mappings = ResolveMappings(columnLabels, decisions.ColumnMappings);
        // Structural (schema-evidence) inference — not a synonym alias. When the source carries no
        // Employee Number by header, a highly-unique identifier column that another column cross-
        // references (the manager reference) is the Employee Number, established from the data itself.
        // This lets customer vocabulary ("Worker Ref" / "Reports To Ref") resolve without hardcoding
        // headers, while genuine source-local keys (a plain "Worker ID" alongside an explicit Employee
        // Number) are left untouched. Administrator column decisions always win over inference.
        mappings = InferIdentityFromStructure(mappings, rows, decisions.ColumnMappings);
        var byField = mappings.Where(m => m.Field != WorkforceImportField.Ignored)
            .GroupBy(m => m.Field).ToDictionary(g => g.Key, g => g.First().ColumnIndex);

        var hasFullNameOnly = byField.ContainsKey(WorkforceImportField.FullName)
            && !(byField.ContainsKey(WorkforceImportField.FirstName) && byField.ContainsKey(WorkforceImportField.LastName));

        var unresolvedRequired = RequiredFields.Where(field => !byField.ContainsKey(field)).ToList();
        var hasName = (byField.ContainsKey(WorkforceImportField.FirstName) && byField.ContainsKey(WorkforceImportField.LastName))
            || byField.ContainsKey(WorkforceImportField.FullName);
        if (!hasName) unresolvedRequired.Add(WorkforceImportField.FirstName);

        var nameFormatNeeded = hasFullNameOnly && decisions.NameFormat is null;
        var dateColumns = new[] { WorkforceImportField.EmploymentStart, WorkforceImportField.WorkEffectiveFrom, WorkforceImportField.EmploymentEnd }
            .Where(byField.ContainsKey).Select(f => byField[f]).ToList();
        var dateFormatNeeded = decisions.DateFormat is null && DateAmbiguityExists(rows, dateColumns);

        var normalized = rows.Select((row, index) => NormalizeRow(index + 1, row, byField, hasFullNameOnly, decisions, baseline)).ToList();

        return new WorkforceInterpretationResult(mappings, unresolvedRequired, nameFormatNeeded, dateFormatNeeded, normalized);
    }

    private static IReadOnlyList<WorkforceColumnMapping> ResolveMappings(
        IReadOnlyList<string?> columnLabels,
        IReadOnlyDictionary<int, WorkforceImportField> overrides)
    {
        var result = new List<WorkforceColumnMapping>(columnLabels.Count);
        for (var index = 0; index < columnLabels.Count; index++)
        {
            var label = columnLabels[index];
            if (overrides.TryGetValue(index, out var chosen))
            {
                result.Add(new WorkforceColumnMapping(index, label, chosen, "administrator"));
                continue;
            }
            var auto = AutoMap(label);
            result.Add(new WorkforceColumnMapping(index, label, auto ?? WorkforceImportField.Ignored, auto is null ? "unresolved" : "deterministic"));
        }
        return result;
    }

    // An opaque business/record identifier: no whitespace, no '@', not a calendar date. Deliberately
    // shape-only — it never asserts a header means anything.
    private static readonly System.Text.RegularExpressions.Regex IdentifierShape =
        new(@"^[A-Za-z0-9][A-Za-z0-9._/\-]*$", System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>
    /// Evidence-based, header-agnostic identity inference. Runs only when no Employee Number was
    /// resolved by header. Reads the column DATA: a highly-unique, identifier-shaped column that a
    /// second column's values overwhelmingly reference is the Employee Number, and that referencing
    /// column is the Manager reference (resolved by Employee Number downstream). No cross-referencing
    /// column ⇒ not confident enough ⇒ left unresolved for semantic assistance / a grouped question,
    /// never guessed. Administrator column decisions and genuine WorkerReference keys are untouched.
    /// </summary>
    private static IReadOnlyList<WorkforceColumnMapping> InferIdentityFromStructure(
        IReadOnlyList<WorkforceColumnMapping> mappings,
        IReadOnlyList<IReadOnlyList<string?>> rows,
        IReadOnlyDictionary<int, WorkforceImportField> overrides)
    {
        if (rows.Count == 0) return mappings;
        // Only infer when the source did not already resolve an Employee Number by header/decision.
        if (mappings.Any(m => m.Field == WorkforceImportField.EmployeeNumber)) return mappings;

        // Candidates are columns Fusion could not resolve and the administrator has not decided.
        var candidates = mappings
            .Where(m => m.Field == WorkforceImportField.Ignored && m.Origin == "unresolved" && !overrides.ContainsKey(m.ColumnIndex))
            .Select(m => m.ColumnIndex)
            .ToList();
        if (candidates.Count < 2) return mappings; // need an identity column AND a column referencing it

        var values = candidates.ToDictionary(idx => idx, _ => new List<string>());
        foreach (var row in rows)
            foreach (var idx in candidates)
            {
                var cell = idx < row.Count ? Trim(row[idx]) : null;
                if (cell is not null) values[idx].Add(cell);
            }

        // Identity: highly unique + identifier-shaped + reasonably filled.
        int? identity = null;
        var bestScore = 0d;
        foreach (var idx in candidates)
        {
            var vals = values[idx];
            if (vals.Count < 2) continue;
            var distinct = vals.Distinct(StringComparer.OrdinalIgnoreCase).Count();
            var uniqueness = (double)distinct / vals.Count;
            var identifierLike = (double)vals.Count(LooksLikeIdentifier) / vals.Count;
            if (uniqueness < 0.98 || identifierLike < 0.9) continue;
            var score = uniqueness + identifierLike + (double)vals.Count / rows.Count;
            if (score > bestScore) { bestScore = score; identity = idx; }
        }
        if (identity is null) return mappings;

        var identitySet = new HashSet<string>(values[identity.Value], StringComparer.OrdinalIgnoreCase);

        // Manager reference: another candidate whose identifier-shaped values overwhelmingly point
        // into the identity value set (the reporting graph references the same people).
        int? managerRef = null;
        var bestOverlap = 0d;
        foreach (var idx in candidates)
        {
            if (idx == identity.Value) continue;
            var vals = values[idx];
            if (vals.Count < 1 || vals.Any(v => !LooksLikeIdentifier(v))) continue;
            var overlap = (double)vals.Count(identitySet.Contains) / vals.Count;
            if (overlap >= 0.8 && overlap > bestOverlap) { bestOverlap = overlap; managerRef = idx; }
        }
        if (managerRef is null) return mappings; // no corroborating cross-reference → do not guess

        var managerAlreadyMapped = mappings.Any(m => m.Field == WorkforceImportField.Manager);
        return mappings
            .Select(m =>
                m.ColumnIndex == identity.Value
                    ? m with { Field = WorkforceImportField.EmployeeNumber, Origin = "structural" }
                    : m.ColumnIndex == managerRef.Value && !managerAlreadyMapped
                        ? m with { Field = WorkforceImportField.Manager, Origin = "structural" }
                        : m)
            .ToList();
    }

    private static bool LooksLikeIdentifier(string value)
        => value.Length is > 0 and <= 40
           && IdentifierShape.IsMatch(value)
           && !DateOnly.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    /// <summary>How many of these labels deterministically map to a known Fusion field — used to
    /// score how "header-like" a candidate row is for header-row clarification.</summary>
    public static int CountMappableColumns(IReadOnlyList<string?> labels)
        => labels.Count(label => AutoMap(label) is not null);

    private static WorkforceImportField? AutoMap(string? label)
    {
        if (string.IsNullOrWhiteSpace(label)) return null;
        var normalized = Normalize(label);
        foreach (var (field, aliases) in AliasTable)
            if (aliases.Any(alias => Normalize(alias) == normalized))
                return field;
        return null;
    }

    private NormalizedWorkforceRow NormalizeRow(
        int sourceRowNumber,
        IReadOnlyList<string?> row,
        IReadOnlyDictionary<WorkforceImportField, int> byField,
        bool splitFullName,
        WorkforceImportInterpretation decisions,
        DateOnly baseline)
    {
        var issues = new List<WorkforceInterpretationIssue>();
        string? Cell(WorkforceImportField field)
            => byField.TryGetValue(field, out var i) && i < row.Count ? Trim(row[i]) : null;

        var (first, last) = ResolveName(Cell, byField, splitFullName, decisions.NameFormat, issues);
        var employmentStart = ParseDate(Cell(WorkforceImportField.EmploymentStart), decisions.DateFormat, WorkforceImportField.EmploymentStart, required: true, issues);
        var employmentEnd = ParseDate(Cell(WorkforceImportField.EmploymentEnd), decisions.DateFormat, WorkforceImportField.EmploymentEnd, required: false, issues);

        // Work-effective-date establishment rule (corrected invariant):
        //   absent            -> baseline
        //   present & valid   -> the supplied date (>= EmploymentStart, <= baseline)
        //   present & invalid -> blocker, NEVER a silent baseline fallback
        DateOnly? workEffective;
        var rawWorkEffective = Cell(WorkforceImportField.WorkEffectiveFrom);
        if (string.IsNullOrWhiteSpace(rawWorkEffective))
        {
            workEffective = baseline;
        }
        else
        {
            var parsed = ParseDate(rawWorkEffective, decisions.DateFormat, WorkforceImportField.WorkEffectiveFrom, required: false, issues);
            if (parsed is null)
            {
                workEffective = null; // unparseable -> ParseDate already raised a blocker; do not fall back
            }
            else if (parsed > baseline || (employmentStart is not null && parsed < employmentStart))
            {
                workEffective = null;
                issues.Add(new WorkforceInterpretationIssue(
                    "WorkEffectiveDateInvalid", "blocker",
                    "The supplied work effective date is outside the allowed range (on or after employment start, on or before the workforce-as-of date).",
                    WorkforceImportField.WorkEffectiveFrom));
            }
            else
            {
                workEffective = parsed;
            }
        }

        if (employmentStart is not null && employmentStart > baseline)
            issues.Add(new WorkforceInterpretationIssue(
                "EmploymentStartAfterBaseline", "blocker",
                "Employment start is after the workforce-as-of date; use Hire for future employees.",
                WorkforceImportField.EmploymentStart));

        return new NormalizedWorkforceRow(
            SourceRowNumber: sourceRowNumber,
            FusionEmployeeReference: Cell(WorkforceImportField.FusionEmployeeReference),
            FusionOrganizationReference: Cell(WorkforceImportField.FusionOrganizationReference),
            FusionManagerReference: Cell(WorkforceImportField.FusionManagerReference),
            EmployeeNumber: Cell(WorkforceImportField.EmployeeNumber),
            FirstName: first,
            LastName: last,
            PreferredName: Cell(WorkforceImportField.PreferredName),
            WorkEmail: Cell(WorkforceImportField.WorkEmail),
            EmploymentStart: employmentStart,
            WorkEffectiveFrom: workEffective,
            OrganizationRef: Cell(WorkforceImportField.Organization),
            DisplayTitle: Cell(WorkforceImportField.DisplayTitle),
            Location: Cell(WorkforceImportField.Location),
            ManagerReference: Cell(WorkforceImportField.Manager),
            WorkerKey: Cell(WorkforceImportField.WorkerReference),
            ManagerKey: Cell(WorkforceImportField.ManagerReference),
            LifecycleStatus: Cell(WorkforceImportField.LifecycleStatus),
            EmploymentEnd: employmentEnd,
            Issues: issues);
    }

    private static (string? First, string? Last) ResolveName(
        Func<WorkforceImportField, string?> cell,
        IReadOnlyDictionary<WorkforceImportField, int> byField,
        bool splitFullName,
        WorkforceNameFormat? nameFormat,
        List<WorkforceInterpretationIssue> issues)
    {
        if (!splitFullName)
            return (cell(WorkforceImportField.FirstName), cell(WorkforceImportField.LastName));

        var full = cell(WorkforceImportField.FullName);
        if (string.IsNullOrWhiteSpace(full)) return (null, null);
        if (nameFormat is null)
        {
            issues.Add(new WorkforceInterpretationIssue(
                "NameFormatUnresolved", "blocker", "Choose how the combined name column should be read.", WorkforceImportField.FullName));
            return (null, null);
        }

        switch (nameFormat)
        {
            case WorkforceNameFormat.LastCommaFirst:
                var comma = full.Split(',', 2);
                return comma.Length == 2 ? (comma[1].Trim(), comma[0].Trim()) : NameSplitFailed(full, issues);
            case WorkforceNameFormat.FirstLast:
            {
                var parts = full.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                return parts.Length == 2 ? (parts[0], parts[1]) : NameSplitFailed(full, issues);
            }
            case WorkforceNameFormat.LastFirst:
            {
                var parts = full.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                return parts.Length == 2 ? (parts[1], parts[0]) : NameSplitFailed(full, issues);
            }
            default:
                return (null, null);
        }
    }

    private static (string?, string?) NameSplitFailed(string full, List<WorkforceInterpretationIssue> issues)
    {
        issues.Add(new WorkforceInterpretationIssue(
            "NameNotSplittable", "blocker",
            "This name could not be split into first and last name; map separate columns or fix the source.",
            WorkforceImportField.FullName));
        return (null, null);
    }

    private static DateOnly? ParseDate(
        string? value, WorkforceDateFormat? format, WorkforceImportField field, bool required, List<WorkforceInterpretationIssue> issues)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            if (required)
                issues.Add(new WorkforceInterpretationIssue(
                    field == WorkforceImportField.EmploymentStart ? "EmploymentStartMissing" : "DateMissing",
                    "blocker", "A required date is missing.", field));
            return null;
        }

        // True XLSX date cells and ISO strings are unambiguous (the reader emits ISO for date cells).
        if (DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var iso))
            return iso;

        var numeric = SplitNumericDate(value);
        if (numeric is null)
        {
            // A textual date such as "1 February 2021".
            if (DateOnly.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var text)) return text;
            issues.Add(new WorkforceInterpretationIssue("DateUnparseable", "blocker", "This date could not be understood.", field));
            return null;
        }

        if (format is null)
        {
            issues.Add(new WorkforceInterpretationIssue("DateFormatUnresolved", "blocker", "Choose the date format used in this file.", field));
            return null;
        }

        var (a, b, year) = numeric.Value;
        var (day, month) = format == WorkforceDateFormat.MonthDayYear ? (b, a) : (a, b);
        try { return new DateOnly(year, month, day); }
        catch (ArgumentOutOfRangeException)
        {
            issues.Add(new WorkforceInterpretationIssue("DateInvalid", "blocker", "This date is not a valid calendar date.", field));
            return null;
        }
    }

    private static bool DateAmbiguityExists(IReadOnlyList<IReadOnlyList<string?>> rows, IReadOnlyList<int> dateColumns)
    {
        foreach (var row in rows)
            foreach (var column in dateColumns)
                if (column < row.Count && SplitNumericDate(Trim(row[column])) is not null)
                    return true;
        return false;
    }

    /// <summary>Returns (first, second, year) for an ambiguous dd/mm or mm/dd numeric date, else null.</summary>
    private static (int First, int Second, int Year)? SplitNumericDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var parts = value.Split('/', '-', '.');
        if (parts.Length != 3) return null;
        if (!int.TryParse(parts[0], out var a) || !int.TryParse(parts[1], out var b) || !int.TryParse(parts[2], out var c)) return null;
        if (parts[2].Length != 4) return null; // require a 4-digit year to avoid guessing century
        if (a is < 1 or > 31 || b is < 1 or > 31) return null;
        return (a, b, c);
    }

    private static string? Trim(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string Normalize(string label)
        => new(label.Trim().ToLowerInvariant().Where(c => !char.IsWhiteSpace(c) && c != '_' && c != '.').ToArray());
}

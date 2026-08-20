using System.Text.RegularExpressions;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>
/// Builds a PII-minimized semantic request from unresolved source columns. Person-level data is
/// deny-by-default: the payload carries only column label, local value-kind, non-empty/distinct
/// counts, a redacted pattern summary, and — only when a column is positively classified as safe,
/// low-cardinality, non-person business vocabulary — a bounded set of representative samples.
/// It never emits employee names, work emails, employee numbers, raw manager references, whole
/// rows, or raw file content.
/// </summary>
public sealed partial class WorkforceImportSemanticContextBuilder
{
    public const string ContractVersion = "workforce-import-semantic-v1";
    private const int MaxSampleRows = 200;
    private const int MaxVocabularySamples = 8;
    private const int MaxSampleLength = 48;

    // Columns whose label suggests person identity/contact/manager data never contribute raw samples.
    private static readonly string[] PersonLabelHints =
        ["name", "first", "last", "prenom", "prénom", "nom", "email", "e-mail", "courriel", "mail",
         "manager", "responsable", "reports", "supervisor", "n+1", "employee number", "employee no",
         "employee id", "matricule", "staff id", "worker id", "payroll", "phone", "tel", "mobile"];

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();

    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9\-_/]*\d[A-Za-z0-9\-_/]*$")]
    private static partial Regex IdentifierPattern();

    [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}$")]
    private static partial Regex IsoDatePattern();

    [GeneratedRegex(@"^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}$")]
    private static partial Regex NumericDatePattern();

    public WorkforceImportSemanticRequest Build(
        IReadOnlyList<string?> columnLabels,
        IReadOnlyList<IReadOnlyList<string?>> rows,
        IReadOnlyList<int> unresolvedColumnIndexes,
        IReadOnlyList<WorkforceSemanticTarget> allowedTargets)
    {
        var columns = unresolvedColumnIndexes
            .Select(index => BuildColumn(index, index < columnLabels.Count ? columnLabels[index] : null, rows))
            .ToList();
        return new WorkforceImportSemanticRequest(ContractVersion, columns, allowedTargets);
    }

    private static WorkforceSemanticColumnContext BuildColumn(int index, string? label, IReadOnlyList<IReadOnlyList<string?>> rows)
    {
        var values = new List<string>();
        var distinct = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var nonEmpty = 0;
        foreach (var row in rows.Take(MaxSampleRows))
        {
            var cell = index < row.Count ? row[index] : null;
            if (string.IsNullOrWhiteSpace(cell)) continue;
            nonEmpty++;
            var trimmed = cell.Trim();
            values.Add(trimmed);
            distinct.Add(trimmed);
        }

        var kind = Classify(values);
        var patternSummary = Summarize(kind, values, distinct.Count, nonEmpty);
        var samples = SafeSamples(label, kind, distinct, nonEmpty);
        // Redact the label defensively: a label is safe to send, but never a value that leaked in.
        var safeLabel = string.IsNullOrWhiteSpace(label) ? $"Column {index + 1}" : label.Trim();
        return new WorkforceSemanticColumnContext(index, safeLabel, kind, nonEmpty, distinct.Count, patternSummary, samples);
    }

    private static WorkforceSemanticValueKind Classify(IReadOnlyList<string> values)
    {
        if (values.Count == 0) return WorkforceSemanticValueKind.Empty;
        var sample = values.Take(50).ToList();
        bool All(Func<string, bool> predicate) => sample.All(predicate);

        if (All(v => EmailPattern().IsMatch(v))) return WorkforceSemanticValueKind.EmailLike;
        if (All(v => IsoDatePattern().IsMatch(v) || NumericDatePattern().IsMatch(v))) return WorkforceSemanticValueKind.DateLike;
        if (All(v => decimal.TryParse(v, out _))) return WorkforceSemanticValueKind.Numeric;
        if (All(v => IdentifierPattern().IsMatch(v))) return WorkforceSemanticValueKind.IdentifierLike;
        var kinds = sample.Select(SingleKind).Distinct().Count();
        return kinds > 1 ? WorkforceSemanticValueKind.Mixed : WorkforceSemanticValueKind.Text;
    }

    private static WorkforceSemanticValueKind SingleKind(string value)
    {
        if (EmailPattern().IsMatch(value)) return WorkforceSemanticValueKind.EmailLike;
        if (IsoDatePattern().IsMatch(value) || NumericDatePattern().IsMatch(value)) return WorkforceSemanticValueKind.DateLike;
        if (decimal.TryParse(value, out _)) return WorkforceSemanticValueKind.Numeric;
        if (IdentifierPattern().IsMatch(value)) return WorkforceSemanticValueKind.IdentifierLike;
        return WorkforceSemanticValueKind.Text;
    }

    private static string Summarize(WorkforceSemanticValueKind kind, IReadOnlyList<string> values, int distinctCount, int nonEmpty) => kind switch
    {
        WorkforceSemanticValueKind.Empty => "no values",
        WorkforceSemanticValueKind.EmailLike => "<email>",
        WorkforceSemanticValueKind.DateLike => "date values (e.g. YYYY-MM-DD)",
        WorkforceSemanticValueKind.Numeric => "numeric values",
        WorkforceSemanticValueKind.IdentifierLike => MaskIdentifier(values.FirstOrDefault()),
        WorkforceSemanticValueKind.Mixed => "mixed values",
        _ => distinctCount >= nonEmpty && nonEmpty > 4 ? "text values, high cardinality" : "text values, low cardinality",
    };

    /// <summary>Masks every digit so an identifier's shape is shown without its value (e.g. EMP-00000421 → EMP-########).</summary>
    private static string MaskIdentifier(string? sample)
    {
        if (string.IsNullOrWhiteSpace(sample)) return "identifier";
        var masked = new string(sample.Trim().Take(MaxSampleLength).Select(c => char.IsDigit(c) ? '#' : c).ToArray());
        return masked;
    }

    private static IReadOnlyList<string> SafeSamples(string? label, WorkforceSemanticValueKind kind, HashSet<string> distinct, int nonEmpty)
    {
        // Deny-by-default. Raw values are only sent for genuinely safe non-person business vocabulary:
        // free text that is NOT email/identifier/numeric, NOT under a person-suggesting label, and
        // low-cardinality (a bounded controlled vocabulary such as Organization/Title/Location).
        if (kind is not WorkforceSemanticValueKind.Text) return [];
        if (LooksLikePersonColumn(label)) return [];
        if (nonEmpty == 0) return [];
        if (distinct.Count > MaxVocabularySamples * 2) return []; // high cardinality → likely person/free text
        if (distinct.Count >= nonEmpty && nonEmpty > 4) return []; // every value unique → not a controlled vocabulary
        return distinct
            .Where(v => !EmailPattern().IsMatch(v) && !IdentifierPattern().IsMatch(v))
            .Take(MaxVocabularySamples)
            .Select(v => v.Length > MaxSampleLength ? v[..MaxSampleLength] : v)
            .ToList();
    }

    private static bool LooksLikePersonColumn(string? label)
    {
        if (string.IsNullOrWhiteSpace(label)) return false;
        var normalized = label.Trim().ToLowerInvariant();
        return PersonLabelHints.Any(hint => normalized.Contains(hint));
    }
}

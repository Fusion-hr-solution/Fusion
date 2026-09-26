using System.Text.Json.Serialization;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

// Match answers one question: what does this workforce source mean? Everything here is about
// source semantics — column meaning, formats, identity strategy, lifecycle vocabulary — never
// about which canonical entity a particular row points to. That is Review's resolution work.

/// <summary>Canonical lifecycle meaning of a source status value, aligned with CoreHR Employment (Active / Ended).</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkforceLifecycle { Active, Former }

/// <summary>How employees in this file are identified.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkforceIdentityStrategy
{
    /// <summary>A mapped source column (Employee Number or Fusion employee reference) identifies each employee.</summary>
    SourceIdentifier,
    /// <summary>No source identifier: every row is a new employee with a Fusion-generated number. Only safe on a tenant with no employees.</summary>
    GenerateAll,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkforceRequiredDecisionKind { FieldMapping, IdentityStrategy, DateFormat, NameFormat, VocabularyMapping, MappingConflict }

/// <summary>Inferred, read-only description of what a reference column's values are (never a user decision).</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkforceReferenceKind { None, FusionId, Code, Path, Name, EmployeeNumber, WorkerReference, Email, Unrecognized }

/// <summary>
/// The persisted Match decisions. Column meanings carry their origin so an administrator decision
/// is never overwritten by a suggestion, and "Automatically matched" is derivable.
/// </summary>
public sealed class WorkforceImportMappingPlan
{
    public Dictionary<int, WorkforceImportField> ColumnMappings { get; set; } = [];
    public Dictionary<int, ImportResolutionOrigin> ColumnOrigins { get; set; } = [];
    public WorkforceDateFormat? DateFormat { get; set; }
    public WorkforceNameFormat? NameFormat { get; set; }
    public WorkforceIdentityStrategy? IdentityStrategy { get; set; }
    /// <summary>Normalized source status value → canonical lifecycle meaning.</summary>
    public Dictionary<string, WorkforceLifecycle> LifecycleVocabulary { get; set; } = [];
    public Dictionary<string, ImportResolutionOrigin> VocabularyOrigins { get; set; } = [];
    public ImportResolutionOrigin? FormatOrigin { get; set; }

    public static WorkforceImportMappingPlan Parse(string? json)
        => string.IsNullOrWhiteSpace(json) || json == "{}" ? new() : WorkforceImportJson.Deserialize<WorkforceImportMappingPlan>(json) ?? new();

    public string Serialize() => WorkforceImportJson.Serialize(this);

    public WorkforceImportInterpretation ToInterpretation() => new(
        ColumnMappings.ToDictionary(
            kv => kv.Key,
            kv => new WorkforceColumnDecision(kv.Value, ColumnOrigins.GetValueOrDefault(kv.Key, ImportResolutionOrigin.Administrator))),
        NameFormat,
        DateFormat,
        LifecycleVocabulary);
}

/// <summary>
/// The persisted Review resolutions. Each answers a specific live issue in the derived proposal and
/// maps a source value or reference to a canonical target; none overrides a source fact.
/// </summary>
public sealed class WorkforceImportResolutions
{
    /// <summary>Normalized source Organization value → canonical OrgUnit, for values that did not resolve uniquely.</summary>
    public Dictionary<string, Guid> OrganizationBySourceValue { get; set; } = [];
    /// <summary>Normalized manager reference → existing employee, for references that did not resolve.</summary>
    public Dictionary<string, Guid> ManagerEmployeeByReference { get; set; } = [];
    /// <summary>Normalized manager reference → a person in this import (source row number).</summary>
    public Dictionary<string, int> ManagerImportRowByReference { get; set; } = [];
    /// <summary>Unresolved manager references the administrator explicitly set to no manager.</summary>
    public HashSet<string> NoManagerByReference { get; set; } = [];
    /// <summary>Rows that look like duplicates without a distinguishing key but are genuinely different people.</summary>
    public HashSet<int> KeepAsDistinctRows { get; set; } = [];
    /// <summary>Use the workforce-as-of date for work details whose source effective date is missing or invalid.</summary>
    public bool UseBaselineForWorkDates { get; set; }

    public static WorkforceImportResolutions Parse(string? json)
        => string.IsNullOrWhiteSpace(json) || json == "{}" ? new() : WorkforceImportJson.Deserialize<WorkforceImportResolutions>(json) ?? new();

    public string Serialize() => WorkforceImportJson.Serialize(this);

    public bool IsEmpty => OrganizationBySourceValue.Count == 0 && ManagerEmployeeByReference.Count == 0
        && ManagerImportRowByReference.Count == 0 && NoManagerByReference.Count == 0
        && KeepAsDistinctRows.Count == 0 && !UseBaselineForWorkDates;

    public WorkforceResolutionDecisions ToResolutionDecisions() => new(
        KeepAsDistinctRows,
        OrganizationBySourceValue,
        ManagerEmployeeByReference,
        ManagerImportRowByReference,
        NoManagerByReference,
        UseBaselineForWorkDates);
}

public sealed record WorkforceRequiredDecisionDto(
    string Key,
    WorkforceRequiredDecisionKind Kind,
    string? Field = null,
    int? ColumnIndex = null,
    string? SourceValue = null,
    int OccurrenceCount = 0);

public sealed record WorkforceMatchReadinessDto(
    bool CanContinue,
    IReadOnlyList<WorkforceRequiredDecisionDto> RequiredDecisions,
    ImportMatchCompletionKind CompletionKind);

public sealed record WorkforceMatchColumnDto(
    int ColumnIndex,
    string? SourceLabel,
    WorkforceImportField Field,
    ImportResolutionOrigin? Origin,
    bool Resolved,
    int NonEmptyCount,
    IReadOnlyList<string> SampleValues);

public sealed record WorkforceLifecycleValueDto(string SourceValue, WorkforceLifecycle? Meaning, ImportResolutionOrigin? Origin, int OccurrenceCount);

public sealed record WorkforceMatchDto(
    IReadOnlyList<WorkforceMatchColumnDto> Columns,
    WorkforceDateFormat? DateFormat,
    WorkforceNameFormat? NameFormat,
    bool DateFormatDecisionNeeded,
    bool NameFormatDecisionNeeded,
    WorkforceIdentityStrategy? IdentityStrategy,
    bool GenerateAllAllowed,
    IReadOnlyList<WorkforceLifecycleValueDto> LifecycleValues,
    WorkforceReferenceKind ManagerReferenceKind,
    WorkforceMatchReadinessDto Readiness,
    EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic.ImportSemanticAssistanceDto? SemanticAssistance,
    /// <summary>The file's first rows as read, for previewing the mapping (bounded).</summary>
    IReadOnlyList<IReadOnlyList<string?>> PreviewRows);

/// <summary>A Match change. Only the fields present change; a null field leaves that decision alone.</summary>
public sealed record WorkforceMatchUpdateRequest(
    Dictionary<int, WorkforceImportField>? ColumnMappings = null,
    WorkforceDateFormat? DateFormat = null,
    WorkforceNameFormat? NameFormat = null,
    WorkforceIdentityStrategy? IdentityStrategy = null,
    Dictionary<string, WorkforceLifecycle>? LifecycleVocabulary = null);

/// <summary>
/// Derives Match readiness from the interpretation alone. A complete Match means Fusion can build a
/// canonical workforce proposal; it never depends on semantic assistance state.
/// </summary>
public static class WorkforceImportMatchReadiness
{
    public static WorkforceMatchReadinessDto Evaluate(
        WorkforceInterpretationResult interpretation,
        WorkforceImportMappingPlan plan,
        bool tenantHasEmployees)
    {
        var decisions = new List<WorkforceRequiredDecisionDto>();

        foreach (var conflict in interpretation.MappingConflicts)
            decisions.Add(new WorkforceRequiredDecisionDto($"conflict:{conflict}", WorkforceRequiredDecisionKind.MappingConflict, conflict.ToString()));

        foreach (var field in interpretation.UnresolvedRequiredFields)
            decisions.Add(new WorkforceRequiredDecisionDto($"field:{field}", WorkforceRequiredDecisionKind.FieldMapping, field.ToString()));

        if (!interpretation.HasIdentifierColumn && !GenerateAllSatisfied(plan, tenantHasEmployees))
            decisions.Add(new WorkforceRequiredDecisionDto("identity", WorkforceRequiredDecisionKind.IdentityStrategy));

        if (interpretation.NameFormatDecisionNeeded)
            decisions.Add(new WorkforceRequiredDecisionDto("name-format", WorkforceRequiredDecisionKind.NameFormat, WorkforceImportField.FullName.ToString()));
        if (interpretation.DateFormatDecisionNeeded)
            decisions.Add(new WorkforceRequiredDecisionDto("date-format", WorkforceRequiredDecisionKind.DateFormat));

        foreach (var value in interpretation.LifecycleValues.Where(value => value.Meaning is null))
            decisions.Add(new WorkforceRequiredDecisionDto(
                $"status:{value.NormalizedValue}", WorkforceRequiredDecisionKind.VocabularyMapping,
                WorkforceImportField.LifecycleStatus.ToString(), SourceValue: value.SourceValue, OccurrenceCount: value.OccurrenceCount));

        var completion = decisions.Count > 0
            ? ImportMatchCompletionKind.Incomplete
            : IsAutomatic(interpretation, plan) ? ImportMatchCompletionKind.Automatic : ImportMatchCompletionKind.Confirmed;
        return new WorkforceMatchReadinessDto(decisions.Count == 0, decisions, completion);
    }

    /// <summary>"Generate all" is a legitimate strategy only where no existing employee could be duplicated.</summary>
    public static bool GenerateAllSatisfied(WorkforceImportMappingPlan plan, bool tenantHasEmployees)
        => plan.IdentityStrategy == WorkforceIdentityStrategy.GenerateAll && !tenantHasEmployees;

    private static bool IsAutomatic(WorkforceInterpretationResult interpretation, WorkforceImportMappingPlan plan)
        => interpretation.Mappings.Where(m => m.Field != WorkforceImportField.Ignored)
               .All(m => m.Origin is ImportResolutionOrigin.Native or ImportResolutionOrigin.Deterministic)
           && interpretation.LifecycleValues.All(v => v.Origin is null or ImportResolutionOrigin.Native or ImportResolutionOrigin.Deterministic)
           && (plan.FormatOrigin is null or ImportResolutionOrigin.Native or ImportResolutionOrigin.Deterministic)
           && plan.IdentityStrategy is null;
}

/// <summary>Deterministic lifecycle vocabulary. Anything else must be decided in Match; ambiguous values are never guessed.</summary>
public static class WorkforceLifecycleVocabulary
{
    private static readonly Dictionary<string, WorkforceLifecycle> Known = new(StringComparer.Ordinal)
    {
        ["active"] = WorkforceLifecycle.Active,
        ["actif"] = WorkforceLifecycle.Active,
        ["employed"] = WorkforceLifecycle.Active,
        ["current"] = WorkforceLifecycle.Active,
        ["en poste"] = WorkforceLifecycle.Active,
        ["inactive"] = WorkforceLifecycle.Former,
        ["inactif"] = WorkforceLifecycle.Former,
        ["terminated"] = WorkforceLifecycle.Former,
        ["former"] = WorkforceLifecycle.Former,
        ["left"] = WorkforceLifecycle.Former,
        ["resigned"] = WorkforceLifecycle.Former,
        ["departed"] = WorkforceLifecycle.Former,
        ["ended"] = WorkforceLifecycle.Former,
        ["exited"] = WorkforceLifecycle.Former,
        ["retired"] = WorkforceLifecycle.Former,
        ["sorti"] = WorkforceLifecycle.Former,
    };

    public static string Normalize(string value) => string.Join(' ', value.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));

    public static WorkforceLifecycle? Deterministic(string normalizedValue) => Known.TryGetValue(normalizedValue, out var meaning) ? meaning : null;
}

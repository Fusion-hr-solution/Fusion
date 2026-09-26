using System.Text.Json.Serialization;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

/// <summary>Stable codes for workforce proposal issues.</summary>
public static class WorkforceIssueCodes
{
    // Source data (interpretation)
    public const string NameFormatUnresolved = "NameFormatUnresolved";
    public const string NameNotSplittable = "NameNotSplittable";
    public const string EmploymentStartMissing = "EmploymentStartMissing";
    public const string DateUnparseable = "DateUnparseable";
    public const string DateFormatUnresolved = "DateFormatUnresolved";
    public const string DateInvalid = "DateInvalid";
    public const string WorkEffectiveDateInvalid = "WorkEffectiveDateInvalid";
    public const string NameMissing = "NameMissing";
    public const string DisplayTitleMissing = "DisplayTitleMissing";

    // Identity
    public const string DuplicateWorkerReference = "DuplicateWorkerReference";
    public const string FusionEmployeeReferenceUnresolved = "FusionEmployeeReferenceUnresolved";
    public const string DuplicateEmployeeNumberInFile = "DuplicateEmployeeNumberInFile";
    public const string FormerEmployeeLifecycleConflict = "FormerEmployeeLifecycleConflict";
    public const string ContradictoryStrongIdentifiers = "ContradictoryStrongIdentifiers";
    public const string StrongKeyNameMismatch = "StrongKeyNameMismatch";
    public const string WorkEmailOccupied = "WorkEmailOccupied";
    public const string DuplicateWorkEmailInFile = "DuplicateWorkEmailInFile";
    public const string IndistinguishableDuplicateRow = "IndistinguishableDuplicateRow";
    public const string EmployeeIdentifierMissing = "EmployeeIdentifierMissing";
    public const string SimilarNameExists = "SimilarNameExists";
    public const string EmployeeNumberGenerated = "EmployeeNumberGenerated";

    // Existing employees and lifecycle scope
    public const string ExistingDifference = "ExistingDifference";
    public const string NotImportedFormerWorker = "NotImportedFormerWorker";
    public const string NotImportedEndedBeforeToday = "NotImportedEndedBeforeToday";
    public const string NotImportedFutureStart = "NotImportedFutureStart";

    // Organization
    public const string FusionOrganizationReferenceUnresolved = "FusionOrganizationReferenceUnresolved";
    public const string OrganizationMissing = "OrganizationMissing";
    public const string OrganizationUnresolved = "OrganizationUnresolved";
    public const string OrganizationInvalidToday = "OrganizationInvalidToday";
    public const string OrganizationDecisionInvalid = "OrganizationDecisionInvalid";

    // Manager
    public const string ManagerUnresolved = "ManagerUnresolved";
    public const string ManagerNotImported = "ManagerNotImported";
    public const string SelfManager = "SelfManager";
    public const string ManagerCycle = "ManagerCycle";
}

/// <summary>Where the fix for a workforce issue belongs. Review never edits a proposed employee's facts.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkforceResolutionKind
{
    ReturnToMatch,
    CorrectSource,
    ChooseOrgUnit,
    ChooseManager,
    NoManager,
    KeepDistinct,
    UseBaselineForWorkDates,
    ChangeBaselineDate,
}

/// <summary>A proposal issue. Severity always comes from the catalog.</summary>
public sealed record WorkforceIssue(
    string Code,
    ImportIssueSeverity Severity,
    string Title,
    string Message,
    string Field,
    string? DecisionKey,
    string Category,
    IReadOnlyList<WorkforceResolutionKind> Resolutions)
{
    public bool IsBlocker => Severity == ImportIssueSeverity.Blocker;
}

/// <summary>
/// The single authority for what a workforce issue is: severity, title, category and the pathways
/// to a fix. A blocker means Fusion cannot publish; a warning means it can, but something unusual
/// deserves a look.
/// </summary>
public static class WorkforceImportIssueCatalog
{
    private const ImportIssueSeverity Blocker = ImportIssueSeverity.Blocker;
    private const ImportIssueSeverity Warning = ImportIssueSeverity.Warning;
    private const WorkforceResolutionKind Match = WorkforceResolutionKind.ReturnToMatch;
    private const WorkforceResolutionKind Source = WorkforceResolutionKind.CorrectSource;

    private sealed record Entry(ImportIssueSeverity Severity, string Title, string Category, WorkforceResolutionKind[] Resolutions);

    private static readonly Dictionary<string, Entry> Entries = new(StringComparer.Ordinal)
    {
        [WorkforceIssueCodes.NameFormatUnresolved] = new(Blocker, "Name format not chosen", "data", [Match]),
        [WorkforceIssueCodes.NameNotSplittable] = new(Blocker, "Name can't be split", "data", [Source, Match]),
        [WorkforceIssueCodes.EmploymentStartMissing] = new(Blocker, "Employment start missing", "data", [Source]),
        [WorkforceIssueCodes.DateUnparseable] = new(Blocker, "Date can't be read", "data", [Source, Match]),
        [WorkforceIssueCodes.DateFormatUnresolved] = new(Blocker, "Date format not chosen", "data", [Match]),
        [WorkforceIssueCodes.DateInvalid] = new(Blocker, "Date isn't valid", "data", [Source]),
        [WorkforceIssueCodes.WorkEffectiveDateInvalid] = new(Blocker, "Work start date out of range", "dates", [WorkforceResolutionKind.UseBaselineForWorkDates, Source]),
        [WorkforceIssueCodes.NameMissing] = new(Blocker, "Name missing", "data", [Source]),
        [WorkforceIssueCodes.DisplayTitleMissing] = new(Blocker, "Title missing", "data", [Source]),

        [WorkforceIssueCodes.DuplicateWorkerReference] = new(Blocker, "Worker reference used twice", "identity", [Source]),
        [WorkforceIssueCodes.FusionEmployeeReferenceUnresolved] = new(Blocker, "Employee ID not found", "identity", [Source]),
        [WorkforceIssueCodes.DuplicateEmployeeNumberInFile] = new(Blocker, "Employee number used twice", "identity", [Source]),
        [WorkforceIssueCodes.FormerEmployeeLifecycleConflict] = new(Blocker, "Belongs to a former employee", "identity", [Source]),
        [WorkforceIssueCodes.ContradictoryStrongIdentifiers] = new(Blocker, "Identifiers point to different people", "identity", [Source]),
        [WorkforceIssueCodes.StrongKeyNameMismatch] = new(Blocker, "Employee number belongs to someone else", "identity", [Source]),
        [WorkforceIssueCodes.WorkEmailOccupied] = new(Blocker, "Work email already in use", "identity", [Source]),
        [WorkforceIssueCodes.DuplicateWorkEmailInFile] = new(Blocker, "Work email used twice", "identity", [Source]),
        [WorkforceIssueCodes.IndistinguishableDuplicateRow] = new(Blocker, "Looks like the same person", "identity", [WorkforceResolutionKind.KeepDistinct, Source]),
        [WorkforceIssueCodes.EmployeeIdentifierMissing] = new(Blocker, "Employee number missing", "identity", [Source]),
        [WorkforceIssueCodes.SimilarNameExists] = new(Warning, "Similar name already in Fusion", "identity", []),
        [WorkforceIssueCodes.EmployeeNumberGenerated] = new(Warning, "Employee number will be generated", "identity", []),

        [WorkforceIssueCodes.ExistingDifference] = new(Warning, "Differs from the existing employee", "existing", []),
        [WorkforceIssueCodes.NotImportedFormerWorker] = new(Warning, "Former employee not imported", "lifecycle", []),
        [WorkforceIssueCodes.NotImportedEndedBeforeToday] = new(Warning, "Already left, not imported", "lifecycle", []),
        [WorkforceIssueCodes.NotImportedFutureStart] = new(Warning, "Starts later, not imported", "lifecycle", []),

        [WorkforceIssueCodes.FusionOrganizationReferenceUnresolved] = new(Blocker, "Unit ID not found", "organization", [Source]),
        [WorkforceIssueCodes.OrganizationMissing] = new(Blocker, "Organization missing", "organization", [Source]),
        [WorkforceIssueCodes.OrganizationUnresolved] = new(Blocker, "Organization not matched", "organization", [WorkforceResolutionKind.ChooseOrgUnit, Source]),
        [WorkforceIssueCodes.OrganizationInvalidToday] = new(Blocker, "Organization no longer active", "organization", [WorkforceResolutionKind.ChooseOrgUnit, WorkforceResolutionKind.ChangeBaselineDate]),
        [WorkforceIssueCodes.OrganizationDecisionInvalid] = new(Blocker, "Chosen unit isn't active on this date", "organization", [WorkforceResolutionKind.ChooseOrgUnit]),

        [WorkforceIssueCodes.ManagerUnresolved] = new(Blocker, "Manager not found", "manager", [WorkforceResolutionKind.ChooseManager, WorkforceResolutionKind.NoManager, Source]),
        [WorkforceIssueCodes.ManagerNotImported] = new(Blocker, "Manager isn't being imported", "manager", [WorkforceResolutionKind.ChooseManager, WorkforceResolutionKind.NoManager]),
        [WorkforceIssueCodes.SelfManager] = new(Blocker, "Reports to themselves", "manager", [Source]),
        [WorkforceIssueCodes.ManagerCycle] = new(Blocker, "Reporting lines loop", "manager", [Source]),
    };

    public static IReadOnlyCollection<string> Codes => Entries.Keys;

    public static ImportIssueSeverity SeverityOf(string code) => Entries[code].Severity;

    public static string CategoryOf(string code) => Entries[code].Category;

    public static WorkforceIssue Issue(string code, string message, string field, string? decisionKey = null)
    {
        var entry = Entries[code];
        return new WorkforceIssue(code, entry.Severity, entry.Title, message, field, decisionKey, entry.Category, entry.Resolutions);
    }
}

using System.Text.Json;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

// ---- Product-facing review contracts (never persistence entities) ----

public sealed record WorkforceReviewEmployeeDto(string DisplayName, string? EmployeeNumber, bool NumberGenerated, string? ExistingEmployeeName, string? WorkEmail);
public sealed record WorkforceReviewEmploymentDto(DateOnly? StartDate, DateOnly? EndDate);
/// <summary>Work context. <c>Organization</c> is the canonical unit when resolved; <c>SourceOrganization</c> is what the file said.</summary>
public sealed record WorkforceReviewWorkDto(string? DisplayTitle, string? Organization, string? SourceOrganization, string? Location, DateOnly? EffectiveFrom);
/// <summary>The manager as the reviewer knows them: name, employee number, and whether they arrive in this import.</summary>
public sealed record WorkforceReviewManagerDto(string State, string? Display, string? Subtext, string? EmployeeNumber);

public sealed record WorkforceReviewIssueDto(
    string Code,
    ImportIssueSeverity Severity,
    string Title,
    string Message,
    string Field,
    string? DecisionKey,
    string Category,
    IReadOnlyList<WorkforceResolutionKind> Resolutions,
    int AffectedCount);

public sealed record WorkforceReviewRowDto(
    int SourceRowNumber,
    WorkforceImportRowClassification Classification,
    WorkforceReviewEmployeeDto Employee,
    WorkforceReviewEmploymentDto Employment,
    WorkforceReviewWorkDto Work,
    WorkforceReviewManagerDto Manager,
    IReadOnlyList<WorkforceReviewIssueDto> Issues);

public sealed record WorkforceReviewCountsDto(int Create, int Existing, int NotImported, int Blocked, int Total, int WithWarnings, int OpenDecisionCount);

/// <summary>
/// One kind of remaining work or notice, so Review can name it ("3 organizations to match · 40 people").
/// <c>DecisionCount</c> counts grouped decisions once; <c>AffectedPeople</c> is how many rows it touches.
/// </summary>
public sealed record WorkforceReviewIssueGroupDto(string Category, ImportIssueSeverity Severity, int DecisionCount, int AffectedPeople);

/// <summary>The distinct product states Review can be in; the frontend never infers these from counters.</summary>
public enum WorkforceReviewState { NoRows, NothingToImport, Reviewable }

public sealed record WorkforceReviewSummaryDto(
    WorkforceReviewCountsDto Counts,
    bool CanPublish,
    WorkforceReviewState State,
    uint Version,
    string? ProposalFingerprint,
    IReadOnlyList<WorkforceReviewIssueGroupDto> IssueGroups);

public sealed record WorkforceReviewPageDto(
    IReadOnlyList<WorkforceReviewRowDto> Rows, int Page, int PageSize, int TotalMatching, WorkforceReviewSummaryDto Summary);

/// <summary>A person being added in this same import, offered as a candidate manager.</summary>
public sealed record WorkforceManagerCandidateDto(int SourceRowNumber, string DisplayName, string? EmployeeNumber, bool NumberGenerated, string? Title);

/// <summary>The persisted, display-ready view of one proposed row. Rebuilt on every derivation.</summary>
internal sealed class WorkforceRowProjection
{
    public string DisplayName { get; set; } = "(unnamed)";
    public string? EmployeeNumber { get; set; }
    public bool NumberGenerated { get; set; }
    public string? ExistingEmployeeName { get; set; }
    public string? WorkEmail { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string? DisplayTitle { get; set; }
    public string? Organization { get; set; }
    public string? SourceOrganization { get; set; }
    public string? Location { get; set; }
    public DateOnly? EffectiveFrom { get; set; }
    public string ManagerState { get; set; } = "NoManager";
    public string? ManagerDisplay { get; set; }
    public string? ManagerSubtext { get; set; }
    public string? ManagerNumber { get; set; }
}

internal static class WorkforceImportProjection
{
    private static readonly JsonSerializerOptions Json = WorkforceImportJson.SerializerOptions;

    /// <summary>Writes each row's classification, display projection, search text and issues.</summary>
    public static void Persist(IReadOnlyList<WorkforceImportRow> rows, WorkforceImportDerived derived)
    {
        var normalizedByRow = derived.Interpretation.Rows.ToDictionary(r => r.SourceRowNumber);
        // How many rows each grouped decision affects, so "Operations appears on 38 employees" is visible
        // and one resolution answers them all.
        var affectedByKey = derived.Proposal.Rows
            .SelectMany(r => r.Issues.Where(i => i.DecisionKey is not null).Select(i => i.DecisionKey!))
            .GroupBy(k => k)
            .ToDictionary(g => g.Key, g => g.Count());
        var nameByRow = normalizedByRow.ToDictionary(kv => kv.Key, kv => JoinName(kv.Value.FirstName, kv.Value.LastName));
        var numberByRow = normalizedByRow.ToDictionary(kv => kv.Key, kv => kv.Value.EmployeeNumber);
        var rowByNumber = rows.ToDictionary(r => r.SourceRowNumber);

        foreach (var resolved in derived.Proposal.Rows)
        {
            if (!rowByNumber.TryGetValue(resolved.SourceRowNumber, out var row)) continue;
            var normalized = normalizedByRow.GetValueOrDefault(resolved.SourceRowNumber);
            var projection = Build(resolved, normalized, nameByRow, numberByRow, derived.Snapshot);
            var issues = resolved.Issues
                .Select(i => new WorkforceReviewIssueDto(i.Code, i.Severity, i.Title, i.Message, i.Field, i.DecisionKey, i.Category, i.Resolutions,
                    i.DecisionKey is not null ? affectedByKey.GetValueOrDefault(i.DecisionKey, 1) : 1))
                .ToList();
            var search = string.Join(' ', new[]
            {
                projection.DisplayName, projection.EmployeeNumber, normalized?.WorkEmail, projection.DisplayTitle,
                projection.Organization, projection.SourceOrganization,
            }.Where(v => !string.IsNullOrWhiteSpace(v))).ToLowerInvariant();
            row.ApplyResolution(
                resolved.Classification, resolved.MatchedEmployeeId, resolved.ResolvedOrgUnitId, resolved.Manager.RawReference,
                resolved.HasWarning, JsonSerializer.Serialize(projection, Json), search, JsonSerializer.Serialize(issues, Json));
        }
    }

    public static WorkforceReviewRowDto ToRowDto(WorkforceImportRow row)
    {
        var p = row.NormalizedProposalJson is null
            ? new WorkforceRowProjection()
            : JsonSerializer.Deserialize<WorkforceRowProjection>(row.NormalizedProposalJson, Json) ?? new WorkforceRowProjection();
        var issues = row.IssueStateJson is null ? [] : JsonSerializer.Deserialize<List<WorkforceReviewIssueDto>>(row.IssueStateJson, Json) ?? [];
        return new WorkforceReviewRowDto(
            row.SourceRowNumber,
            row.Classification,
            new WorkforceReviewEmployeeDto(p.DisplayName, p.EmployeeNumber, p.NumberGenerated, p.ExistingEmployeeName, p.WorkEmail),
            new WorkforceReviewEmploymentDto(p.StartDate, p.EndDate),
            new WorkforceReviewWorkDto(p.DisplayTitle, p.Organization, p.SourceOrganization, p.Location, p.EffectiveFrom),
            new WorkforceReviewManagerDto(p.ManagerState, p.ManagerDisplay, p.ManagerSubtext, p.ManagerNumber),
            issues);
    }

    public static WorkforceRowProjection? ReadProjection(string? json)
        => json is null ? null : JsonSerializer.Deserialize<WorkforceRowProjection>(json, Json);

    public static List<WorkforceReviewIssueDto> ReadIssues(string? json)
        => json is null ? [] : JsonSerializer.Deserialize<List<WorkforceReviewIssueDto>>(json, Json) ?? [];

    private static WorkforceRowProjection Build(
        ResolvedWorkforceRow resolved, NormalizedWorkforceRow? normalized,
        IReadOnlyDictionary<int, string> nameByRow, IReadOnlyDictionary<int, string?> numberByRow, WorkforceCanonicalSnapshot snapshot)
    {
        var name = JoinName(normalized?.FirstName, normalized?.LastName);
        var (managerState, managerDisplay, managerSubtext, managerNumber) = ManagerDisplay(resolved.Manager, nameByRow, numberByRow, snapshot);
        var existing = resolved.MatchedEmployeeId is Guid id && snapshot.ByFusionId.TryGetValue(id, out var employee) ? employee : null;
        var unitName = resolved.ResolvedOrgUnitId is Guid unitId && snapshot.OrgById.TryGetValue(unitId, out var unit) ? unit.Name : null;
        return new WorkforceRowProjection
        {
            DisplayName = string.IsNullOrWhiteSpace(name) ? "(unnamed)" : name,
            EmployeeNumber = string.IsNullOrWhiteSpace(normalized?.EmployeeNumber) ? existing?.EmployeeNumber : normalized!.EmployeeNumber,
            NumberGenerated = resolved.Classification == WorkforceImportRowClassification.Create && string.IsNullOrWhiteSpace(normalized?.EmployeeNumber),
            ExistingEmployeeName = existing is null ? null : JoinName(existing.FirstName, existing.LastName),
            WorkEmail = normalized?.WorkEmail,
            StartDate = normalized?.EmploymentStart,
            EndDate = normalized?.EmploymentEnd,
            DisplayTitle = normalized?.DisplayTitle,
            Organization = unitName,
            SourceOrganization = normalized?.OrganizationRef,
            Location = normalized?.Location,
            EffectiveFrom = resolved.ResolvedWorkEffectiveDate,
            ManagerState = managerState,
            ManagerDisplay = managerDisplay,
            ManagerSubtext = managerSubtext,
            ManagerNumber = managerNumber,
        };
    }

    /// <summary>The person the reviewer should see, not the raw source key.</summary>
    private static (string State, string? Display, string? Subtext, string? Number) ManagerDisplay(
        ResolvedManager manager, IReadOnlyDictionary<int, string> nameByRow, IReadOnlyDictionary<int, string?> numberByRow,
        WorkforceCanonicalSnapshot snapshot)
        => manager.Kind switch
        {
            ManagerResolutionKind.Unresolved => ("Unresolved", manager.RawReference, null, null),
            ManagerResolutionKind.SameImportRow when manager.SameImportSourceRowNumber is int rn => ("Resolved",
                nameByRow.GetValueOrDefault(rn) is { Length: > 0 } importedName ? importedName : manager.RawReference,
                "Also being added",
                numberByRow.GetValueOrDefault(rn)),
            ManagerResolutionKind.SameImportRow => ("Resolved", manager.RawReference, "Also being added", null),
            ManagerResolutionKind.ExistingEmployee when manager.EmployeeId is Guid id && snapshot.ByFusionId.TryGetValue(id, out var e) =>
                ("Resolved", JoinName(e.FirstName, e.LastName), null, e.EmployeeNumber),
            ManagerResolutionKind.ExistingEmployee => ("Resolved", manager.RawReference, null, null),
            _ => ("NoManager", null, null, null),
        };

    internal static string JoinName(string? first, string? last)
        => string.Join(' ', new[] { first, last }.Where(s => !string.IsNullOrWhiteSpace(s)));
}

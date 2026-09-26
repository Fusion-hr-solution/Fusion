namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

// ---- Canonical snapshot (set-based preload; the resolver never queries per row) ----

public sealed record CanonicalEmployeeRef(
    Guid EmployeeId,
    string? EmployeeNumber,
    string? WorkEmail,
    string FirstName,
    string LastName,
    bool IsFormer,
    Guid? OrgUnitId,
    string? DisplayTitle,
    string? Location,
    Guid? ManagerEmployeeId);

/// <param name="EstablishedFrom">
/// The date this unit's canonical Organization history begins (earliest Active effective state).
/// <see cref="DateOnly.MinValue"/> means a legacy unit with no effective-state timeline.
/// </param>
public sealed record CanonicalOrgUnitRef(Guid OrgUnitId, string Code, string Path, string Name, bool ValidToday, DateOnly EstablishedFrom);

public sealed class WorkforceCanonicalSnapshot
{
    public required IReadOnlyDictionary<string, CanonicalEmployeeRef> ByEmployeeNumber { get; init; }
    public required IReadOnlyDictionary<string, CanonicalEmployeeRef> ByWorkEmail { get; init; }
    public required IReadOnlyDictionary<Guid, CanonicalEmployeeRef> ByFusionId { get; init; }
    public required IReadOnlyDictionary<Guid, CanonicalOrgUnitRef> OrgById { get; init; }
    public required IReadOnlyDictionary<string, CanonicalOrgUnitRef> OrgByCode { get; init; }
    public required IReadOnlyDictionary<string, CanonicalOrgUnitRef> OrgByPath { get; init; }
    public required ILookup<string, CanonicalOrgUnitRef> OrgByName { get; init; }

    /// <summary>Whether the tenant already has any employee (active or former) that a row could duplicate.</summary>
    public bool HasEmployees => ByFusionId.Count > 0;

    public static string NormalizeNumber(string value) => value.Trim().ToUpperInvariant();
    public static string NormalizeEmail(string value) => value.Trim().ToLowerInvariant();
    public static string NormalizeOrg(string value) => value.Trim().ToLowerInvariant();
}

// ---- Bounded Review resolutions applied during resolution ----

public sealed record WorkforceResolutionDecisions(
    ISet<int> KeepAsDistinctRows,
    IReadOnlyDictionary<string, Guid> OrganizationBySourceValue,
    // Reference-scoped manager decisions (keyed by the normalized manager reference), so resolving one
    // reference resolves every row that reports to it.
    IReadOnlyDictionary<string, Guid> ManagerEmployeeByReference,
    IReadOnlyDictionary<string, int> ManagerImportRowByReference,
    ISet<string> NoManagerByReference,
    bool UseBaselineForWorkDates = false)
{
    public static WorkforceResolutionDecisions None { get; } = new(
        new HashSet<int>(), new Dictionary<string, Guid>(),
        new Dictionary<string, Guid>(), new Dictionary<string, int>(), new HashSet<string>());
}

// ---- Output ----

public enum ManagerResolutionKind { None, ExistingEmployee, SameImportRow, Unresolved }

public sealed record ResolvedManager(ManagerResolutionKind Kind, Guid? EmployeeId, int? SameImportSourceRowNumber, string? RawReference);

public sealed record ResolvedWorkforceRow(
    int SourceRowNumber,
    WorkforceImportRowClassification Classification,
    Guid? MatchedEmployeeId,
    Guid? ResolvedOrgUnitId,
    DateOnly ResolvedWorkEffectiveDate,
    ResolvedManager Manager,
    IReadOnlyList<WorkforceIssue> Issues)
{
    public bool HasBlocker => Issues.Any(i => i.IsBlocker);
    public bool HasWarning => Issues.Any(i => !i.IsBlocker);
}

public sealed record WorkforceImportProposal(
    IReadOnlyList<ResolvedWorkforceRow> Rows,
    int CreateCount,
    int ExistingCount,
    int BlockedCount,
    int NotImportedCount,
    int WarningCount);

/// <summary>
/// Turns interpreted rows into the create-only establishment proposal: deterministic identity,
/// read-only existing anchors whose differences are surfaced (never applied), lifecycle scope
/// (former and future people are not imported), canonical as-of Organization resolution, and
/// manager resolution against existing employees and people in the same file in any row order.
/// Pure over a preloaded snapshot plus the bounded Review resolutions. Names never establish identity.
/// </summary>
public sealed class WorkforceImportResolver
{
    public WorkforceImportProposal Resolve(
        IReadOnlyList<NormalizedWorkforceRow> rows,
        WorkforceCanonicalSnapshot snapshot,
        WorkforceResolutionDecisions decisions,
        DateOnly baseline,
        DateOnly today)
    {
        // Cross-row evidence gathered once, including O(1) same-import manager lookups.
        var inFileNumbers = CountBy(rows, r => Norm(r.EmployeeNumber, WorkforceCanonicalSnapshot.NormalizeNumber));
        var inFileEmails = CountBy(rows, r => Norm(r.WorkEmail, WorkforceCanonicalSnapshot.NormalizeEmail));
        var workerKeys = CountBy(rows, r => Norm(r.WorkerKey, WorkforceCanonicalSnapshot.NormalizeNumber));
        var index = new SameImportIndex(
            FirstByKey(rows, r => Norm(r.WorkerKey, WorkforceCanonicalSnapshot.NormalizeNumber)),
            FirstByKey(rows, r => Norm(r.EmployeeNumber, WorkforceCanonicalSnapshot.NormalizeNumber)),
            FirstByKey(rows, r => Norm(r.WorkEmail, WorkforceCanonicalSnapshot.NormalizeEmail)));
        var context = new RowContext(index, snapshot, decisions, baseline, today, inFileNumbers, inFileEmails, workerKeys,
            new Dictionary<string, List<int>>(StringComparer.Ordinal));

        var resolved = rows.Select(row => ResolveRow(row, context)).ToList();

        RevalidateManagersNotImported(resolved, decisions);
        DetectManagerCycles(resolved);
        return Summarize(resolved);
    }

    private sealed record SameImportIndex(
        IReadOnlyDictionary<string, NormalizedWorkforceRow> ByWorkerKey,
        IReadOnlyDictionary<string, NormalizedWorkforceRow> ByEmployeeNumber,
        IReadOnlyDictionary<string, NormalizedWorkforceRow> ByEmail);

    private sealed record RowContext(
        SameImportIndex Index,
        WorkforceCanonicalSnapshot Snapshot,
        WorkforceResolutionDecisions Decisions,
        DateOnly Baseline,
        DateOnly Today,
        IReadOnlyDictionary<string, int> InFileNumbers,
        IReadOnlyDictionary<string, int> InFileEmails,
        IReadOnlyDictionary<string, int> WorkerKeys,
        Dictionary<string, List<int>> NewRowSignatures);

    private static ResolvedWorkforceRow ResolveRow(NormalizedWorkforceRow row, RowContext ctx)
    {
        var issues = new List<WorkforceIssue>(row.Issues.Select(i => WorkforceImportIssueCatalog.Issue(i.Code, i.Message, i.Field.ToString())));

        // Work details are dated at the explicit source "effective from" when present, else at the
        // Employment start. When the source date is missing or invalid and the administrator chose to
        // use the workforce-as-of date, the baseline is used and the source date issue is answered.
        var workDateUnusable = issues.Any(i => i.Field == nameof(WorkforceImportField.WorkEffectiveFrom));
        var useBaseline = ctx.Decisions.UseBaselineForWorkDates && workDateUnusable;
        if (useBaseline) issues.RemoveAll(i => i.Field == nameof(WorkforceImportField.WorkEffectiveFrom));
        var resolvedWorkEffective = useBaseline ? ctx.Baseline : row.WorkEffectiveFrom ?? row.EmploymentStart ?? ctx.Baseline;

        if (row.WorkerKey is not null && ctx.WorkerKeys.GetValueOrDefault(WorkforceCanonicalSnapshot.NormalizeNumber(row.WorkerKey)) > 1)
            issues.Add(Issue(WorkforceIssueCodes.DuplicateWorkerReference, "This worker reference appears on more than one row.", "WorkerReference"));

        var anchor = ResolveIdentity(row, ctx, issues);
        if (anchor is not null)
        {
            // Existing employee: an authoritative, read-only anchor. Differences are surfaced, never applied.
            if (anchor.IsFormer)
                issues.Add(Issue(WorkforceIssueCodes.FormerEmployeeLifecycleConflict,
                    "This employee number belongs to a former employee. Rehire them from their profile.", "EmployeeNumber"));
            else
                ApplyExistingDifferences(row, anchor, ctx, resolvedWorkEffective, issues);
            return new ResolvedWorkforceRow(row.SourceRowNumber, WorkforceImportRowClassification.Existing, anchor.EmployeeId, anchor.OrgUnitId,
                resolvedWorkEffective, new ResolvedManager(ManagerResolutionKind.None, null, null, null), issues);
        }

        // People outside establishment scope are deterministically not imported.
        if (NotImportedReason(row, ctx.Baseline, ctx.Today) is { } scope)
            return new ResolvedWorkforceRow(row.SourceRowNumber, WorkforceImportRowClassification.NotImported, null, null,
                resolvedWorkEffective, new ResolvedManager(ManagerResolutionKind.None, null, null, null), [scope]);

        ApplyNewEmployeeIdentityChecks(row, ctx, issues);
        ApplyIndistinguishableDuplicateGuard(row, ctx, issues);
        var orgUnitId = ResolveOrganization(row, ctx, issues);
        var manager = ResolveManager(row, ctx, issues);
        ApplyRequiredNewEmployeeChecks(row, issues);

        return new ResolvedWorkforceRow(row.SourceRowNumber, WorkforceImportRowClassification.Create, null, orgUnitId,
            resolvedWorkEffective, manager, issues);
    }

    private static CanonicalEmployeeRef? ResolveIdentity(NormalizedWorkforceRow row, RowContext ctx, List<WorkforceIssue> issues)
    {
        // Strongest evidence: a Fusion employee reference, only when the column was explicitly mapped as such.
        CanonicalEmployeeRef? byFusionRef = null;
        if (!string.IsNullOrWhiteSpace(row.FusionEmployeeReference))
        {
            if (Guid.TryParse(row.FusionEmployeeReference.Trim(), out var fusionId) && ctx.Snapshot.ByFusionId.TryGetValue(fusionId, out var found))
                byFusionRef = found;
            else
            {
                issues.Add(Issue(WorkforceIssueCodes.FusionEmployeeReferenceUnresolved,
                    "This employee ID doesn't match anyone in Fusion.", "FusionEmployeeReference"));
                return null;
            }
        }

        CanonicalEmployeeRef? byNumber = null;
        if (!string.IsNullOrWhiteSpace(row.EmployeeNumber))
        {
            var normalized = WorkforceCanonicalSnapshot.NormalizeNumber(row.EmployeeNumber);
            if (ctx.InFileNumbers.GetValueOrDefault(normalized) > 1)
                issues.Add(Issue(WorkforceIssueCodes.DuplicateEmployeeNumberInFile,
                    "This employee number appears on more than one row.", "EmployeeNumber", $"empno:{normalized}"));
            ctx.Snapshot.ByEmployeeNumber.TryGetValue(normalized, out byNumber);
        }

        if (byFusionRef is not null && byNumber is not null && byFusionRef.EmployeeId != byNumber.EmployeeId)
        {
            issues.Add(Issue(WorkforceIssueCodes.ContradictoryStrongIdentifiers,
                "The employee ID and employee number point to different people.", "FusionEmployeeReference"));
            return null;
        }

        var matched = byFusionRef ?? byNumber;
        if (matched is not null && NameMateriallyDiffers(row, matched))
            issues.Add(Issue(WorkforceIssueCodes.StrongKeyNameMismatch,
                $"This employee number belongs to {JoinName(matched.FirstName, matched.LastName)} in Fusion.", "EmployeeNumber"));
        return matched;
    }

    /// <summary>
    /// What the file says differently about an existing employee. Fusion keeps its current record;
    /// changes go through the employee's change tasks, never through import.
    /// </summary>
    private static void ApplyExistingDifferences(
        NormalizedWorkforceRow row, CanonicalEmployeeRef anchor, RowContext ctx, DateOnly workEffective, List<WorkforceIssue> issues)
    {
        var differences = new List<string>();
        if (Differs(row.DisplayTitle, anchor.DisplayTitle)) differences.Add("title");
        if (Differs(row.Location, anchor.Location)) differences.Add("location");
        var fileOrg = ResolveOrganization(row, ctx, []);
        if (fileOrg is not null && fileOrg != anchor.OrgUnitId) differences.Add("organization");
        var fileManager = ResolveManager(row, ctx, []);
        if (fileManager.Kind == ManagerResolutionKind.ExistingEmployee && fileManager.EmployeeId != anchor.ManagerEmployeeId)
            differences.Add("manager");
        else if (fileManager.Kind == ManagerResolutionKind.SameImportRow)
            differences.Add("manager");
        if (row.Lifecycle == WorkforceLifecycle.Former || row.EmploymentEnd is not null) differences.Add("employment status");
        _ = workEffective;

        if (differences.Count > 0)
            issues.Add(Issue(WorkforceIssueCodes.ExistingDifference,
                $"The file has a different {JoinList(differences)}. Fusion keeps the current record.", "Existing"));
    }

    private static WorkforceIssue? NotImportedReason(NormalizedWorkforceRow row, DateOnly baseline, DateOnly today)
    {
        if (row.Lifecycle == WorkforceLifecycle.Former || (row.EmploymentEnd is { } end && end <= baseline))
            return Issue(WorkforceIssueCodes.NotImportedFormerWorker, "Former employees aren't imported.", "LifecycleStatus");
        if (row.EmploymentEnd is { } laterEnd && laterEnd > baseline && laterEnd <= today)
            return Issue(WorkforceIssueCodes.NotImportedEndedBeforeToday, "This person has already left, so they aren't imported.", "EmploymentEnd");
        if (row.EmploymentStart is { } start && start > baseline)
            return Issue(WorkforceIssueCodes.NotImportedFutureStart, "Starts after the workforce-as-of date. Add them with Hire.", "EmploymentStart");
        return null;
    }

    private static void ApplyNewEmployeeIdentityChecks(NormalizedWorkforceRow row, RowContext ctx, List<WorkforceIssue> issues)
    {
        if (!string.IsNullOrWhiteSpace(row.WorkEmail))
        {
            var normalized = WorkforceCanonicalSnapshot.NormalizeEmail(row.WorkEmail);
            if (ctx.Snapshot.ByWorkEmail.TryGetValue(normalized, out var holder))
                issues.Add(Issue(WorkforceIssueCodes.WorkEmailOccupied,
                    $"This work email belongs to {JoinName(holder.FirstName, holder.LastName)} in Fusion.", "WorkEmail"));
            if (ctx.InFileEmails.GetValueOrDefault(normalized) > 1)
                issues.Add(Issue(WorkforceIssueCodes.DuplicateWorkEmailInFile,
                    "This work email appears on more than one row.", "WorkEmail", $"email:{normalized}"));
        }

        // Without a source identifier, Fusion generates the number. That is only safe when the
        // tenant has nobody the row could duplicate; otherwise the file must identify the person.
        if (string.IsNullOrWhiteSpace(row.EmployeeNumber) && string.IsNullOrWhiteSpace(row.FusionEmployeeReference))
            issues.Add(ctx.Snapshot.HasEmployees
                ? Issue(WorkforceIssueCodes.EmployeeIdentifierMissing,
                    "Add an employee number so Fusion can tell whether this person already exists.", "EmployeeNumber")
                : Issue(WorkforceIssueCodes.EmployeeNumberGenerated, "Fusion will generate an employee number.", "EmployeeNumber"));

        // Name similarity is a quiet hint only; it never establishes or blocks identity.
        if (row.FirstName is { } first && row.LastName is { } last
            && ctx.Snapshot.ByFusionId.Values.Any(e => NameEquals(e, first, last)))
            issues.Add(Issue(WorkforceIssueCodes.SimilarNameExists, "Someone with the same name is already in Fusion.", "FirstName"));
    }

    private static void ApplyIndistinguishableDuplicateGuard(NormalizedWorkforceRow row, RowContext ctx, List<WorkforceIssue> issues)
    {
        // Two proposed rows that look like the same person and carry no distinguishing key must not
        // silently create two employees.
        var hasDistinguisher = !string.IsNullOrWhiteSpace(row.EmployeeNumber) || !string.IsNullOrWhiteSpace(row.WorkerKey) || !string.IsNullOrWhiteSpace(row.WorkEmail);
        if (hasDistinguisher || ctx.Decisions.KeepAsDistinctRows.Contains(row.SourceRowNumber)) return;
        var signature = string.Join('|',
            (row.FirstName ?? "").Trim().ToLowerInvariant(),
            (row.LastName ?? "").Trim().ToLowerInvariant(),
            (row.OrganizationRef ?? "").Trim().ToLowerInvariant(),
            (row.DisplayTitle ?? "").Trim().ToLowerInvariant());
        if (string.IsNullOrWhiteSpace(signature.Replace("|", ""))) return;
        if (!ctx.NewRowSignatures.TryGetValue(signature, out var list)) ctx.NewRowSignatures[signature] = list = [];
        list.Add(row.SourceRowNumber);
        if (list.Count > 1)
            issues.Add(Issue(WorkforceIssueCodes.IndistinguishableDuplicateRow,
                "Another row looks like the same person and nothing tells them apart.", "FirstName", $"dup:{row.SourceRowNumber}"));
    }

    private static Guid? ResolveOrganization(NormalizedWorkforceRow row, RowContext ctx, List<WorkforceIssue> issues)
    {
        var snapshot = ctx.Snapshot;
        if (!string.IsNullOrWhiteSpace(row.FusionOrganizationReference))
        {
            if (Guid.TryParse(row.FusionOrganizationReference.Trim(), out var orgId) && snapshot.OrgById.TryGetValue(orgId, out var byId))
            {
                if (IsValidNow(byId, ctx)) return byId.OrgUnitId;
                issues.Add(Issue(WorkforceIssueCodes.OrganizationInvalidToday, $"{byId.Name} is no longer active.", "Organization"));
                return null;
            }
            issues.Add(Issue(WorkforceIssueCodes.FusionOrganizationReferenceUnresolved,
                "This unit ID doesn't match any unit in Fusion.", "FusionOrganizationReference"));
            return null;
        }

        var raw = row.OrganizationRef;
        if (string.IsNullOrWhiteSpace(raw))
        {
            issues.Add(Issue(WorkforceIssueCodes.OrganizationMissing, "Every employee needs an organization.", "Organization"));
            return null;
        }
        var normalized = WorkforceCanonicalSnapshot.NormalizeOrg(raw);
        var key = $"org:{normalized}";

        // Stable identity first: business code, then full path, then a name only when it is unique.
        var byName = snapshot.OrgByName[normalized].ToList();
        var candidate = snapshot.OrgByCode.GetValueOrDefault(normalized)
            ?? snapshot.OrgByPath.GetValueOrDefault(normalized)
            ?? (byName.Count == 1 ? byName[0] : null);
        if (candidate is not null && IsValidNow(candidate, ctx)) return candidate.OrgUnitId;

        // A Review resolution answers a value that did not resolve to a usable unit, for every row using it.
        if (ctx.Decisions.OrganizationBySourceValue.TryGetValue(normalized, out var chosen))
        {
            if (snapshot.OrgById.TryGetValue(chosen, out var chosenUnit) && IsValidNow(chosenUnit, ctx)) return chosenUnit.OrgUnitId;
            issues.Add(Issue(WorkforceIssueCodes.OrganizationDecisionInvalid,
                $"The unit chosen for \u201c{raw.Trim()}\u201d isn't active on the workforce-as-of date.", "Organization", key));
            return null;
        }

        if (candidate is not null)
            issues.Add(Issue(WorkforceIssueCodes.OrganizationInvalidToday, $"{candidate.Name} is no longer active.", "Organization", key));
        else
            issues.Add(Issue(WorkforceIssueCodes.OrganizationUnresolved,
                byName.Count > 1 ? $"\u201c{raw.Trim()}\u201d matches more than one unit." : $"\u201c{raw.Trim()}\u201d doesn't match a unit in Fusion.",
                "Organization", key));
        return null;
    }

    /// <summary>A past baseline establishes open-ended current truth, so the unit must also still be valid today.</summary>
    private static bool IsValidNow(CanonicalOrgUnitRef unit, RowContext ctx)
        => ctx.Baseline >= ctx.Today || unit.ValidToday;

    private static ResolvedManager ResolveManager(NormalizedWorkforceRow row, RowContext ctx, List<WorkforceIssue> issues)
    {
        var snapshot = ctx.Snapshot;
        var index = ctx.Index;

        if (!string.IsNullOrWhiteSpace(row.FusionManagerReference))
        {
            if (Guid.TryParse(row.FusionManagerReference.Trim(), out var managerId) && snapshot.ByFusionId.TryGetValue(managerId, out var fusionManager))
            {
                if (fusionManager.EmployeeId == FusionSelf(row, snapshot))
                    issues.Add(SelfManager());
                return new ResolvedManager(ManagerResolutionKind.ExistingEmployee, fusionManager.EmployeeId, null, row.FusionManagerReference);
            }
            issues.Add(Issue(WorkforceIssueCodes.ManagerUnresolved, "This manager ID doesn't match anyone in Fusion.", "Manager"));
            return new ResolvedManager(ManagerResolutionKind.Unresolved, null, null, row.FusionManagerReference);
        }

        var reference = FirstNonEmpty(row.ManagerKey, row.ManagerReference);
        if (string.IsNullOrWhiteSpace(reference))
            return new ResolvedManager(ManagerResolutionKind.None, null, null, null); // blank manager is a valid fact
        var normalizedRef = WorkforceCanonicalSnapshot.NormalizeNumber(reference);

        // Source-local worker reference within this import.
        if (!string.IsNullOrWhiteSpace(row.ManagerKey)
            && index.ByWorkerKey.TryGetValue(WorkforceCanonicalSnapshot.NormalizeNumber(row.ManagerKey), out var byWorker))
            return SameImport(row, byWorker, reference, issues);

        // Employee Number: an existing employee first, then someone else in this import.
        if (snapshot.ByEmployeeNumber.TryGetValue(normalizedRef, out var existingManager) && !existingManager.IsFormer)
            return new ResolvedManager(ManagerResolutionKind.ExistingEmployee, existingManager.EmployeeId, null, reference);
        if (index.ByEmployeeNumber.TryGetValue(normalizedRef, out var sameImport))
            return SameImport(row, sameImport, reference, issues);

        // Work email, when the reference is an email: existing employee first, then this import.
        if (reference.Contains('@'))
        {
            var email = WorkforceCanonicalSnapshot.NormalizeEmail(reference);
            if (snapshot.ByWorkEmail.TryGetValue(email, out var existingByEmail) && !existingByEmail.IsFormer)
                return new ResolvedManager(ManagerResolutionKind.ExistingEmployee, existingByEmail.EmployeeId, null, reference);
            if (index.ByEmail.TryGetValue(email, out var sameByEmail))
                return SameImport(row, sameByEmail, reference, issues);
        }

        // Anything else, including a name, is never matched automatically. A Review resolution for
        // this reference answers it for everyone who reports to it.
        if (ReferenceDecision(normalizedRef, row, ctx, issues) is { } decided) return decided;

        issues.Add(Issue(WorkforceIssueCodes.ManagerUnresolved,
            $"“{reference.Trim()}” doesn't match anyone in Fusion or in this file.", "Manager", $"mgr:{normalizedRef}"));
        return new ResolvedManager(ManagerResolutionKind.Unresolved, null, null, reference);
    }

    private static ResolvedManager? ReferenceDecision(string normalizedRef, NormalizedWorkforceRow row, RowContext ctx, List<WorkforceIssue> issues)
    {
        var decisions = ctx.Decisions;
        if (decisions.NoManagerByReference.Contains(normalizedRef))
            return new ResolvedManager(ManagerResolutionKind.None, null, null, normalizedRef);
        if (decisions.ManagerEmployeeByReference.TryGetValue(normalizedRef, out var chosenManager))
        {
            if (chosenManager == FusionSelf(row, ctx.Snapshot)) issues.Add(SelfManager());
            return new ResolvedManager(ManagerResolutionKind.ExistingEmployee, chosenManager, null, normalizedRef);
        }
        if (decisions.ManagerImportRowByReference.TryGetValue(normalizedRef, out var chosenRow))
        {
            if (chosenRow == row.SourceRowNumber) issues.Add(SelfManager());
            return new ResolvedManager(ManagerResolutionKind.SameImportRow, null, chosenRow, normalizedRef);
        }
        return null;
    }

    private static ResolvedManager SameImport(NormalizedWorkforceRow row, NormalizedWorkforceRow target, string reference, List<WorkforceIssue> issues)
    {
        if (target.SourceRowNumber == row.SourceRowNumber) issues.Add(SelfManager());
        return new ResolvedManager(ManagerResolutionKind.SameImportRow, null, target.SourceRowNumber, reference);
    }

    private static void ApplyRequiredNewEmployeeChecks(NormalizedWorkforceRow row, List<WorkforceIssue> issues)
    {
        if ((string.IsNullOrWhiteSpace(row.FirstName) || string.IsNullOrWhiteSpace(row.LastName))
            && !issues.Any(i => i.Code is WorkforceIssueCodes.NameFormatUnresolved or WorkforceIssueCodes.NameNotSplittable))
            issues.Add(Issue(WorkforceIssueCodes.NameMissing, "First and last name are required.", "FirstName"));
        if (string.IsNullOrWhiteSpace(row.DisplayTitle))
            issues.Add(Issue(WorkforceIssueCodes.DisplayTitleMissing, "A title is required.", "DisplayTitle"));
    }

    /// <summary>
    /// A same-file manager who is not being imported cannot be anyone's manager. A Review resolution
    /// for that reference (another person, or no manager) answers it.
    /// </summary>
    private static void RevalidateManagersNotImported(List<ResolvedWorkforceRow> rows, WorkforceResolutionDecisions decisions)
    {
        var byRow = rows.ToDictionary(r => r.SourceRowNumber);
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (row.Classification != WorkforceImportRowClassification.Create) continue;
            if (row.Manager is not { Kind: ManagerResolutionKind.SameImportRow, SameImportSourceRowNumber: int target, RawReference: { } raw }) continue;
            if (!byRow.TryGetValue(target, out var managerRow) || managerRow.Classification != WorkforceImportRowClassification.NotImported) continue;

            var normalizedRef = WorkforceCanonicalSnapshot.NormalizeNumber(raw);
            ResolvedManager? decided = decisions.NoManagerByReference.Contains(normalizedRef)
                ? new ResolvedManager(ManagerResolutionKind.None, null, null, normalizedRef)
                : decisions.ManagerEmployeeByReference.TryGetValue(normalizedRef, out var existing)
                    ? new ResolvedManager(ManagerResolutionKind.ExistingEmployee, existing, null, normalizedRef)
                    : decisions.ManagerImportRowByReference.TryGetValue(normalizedRef, out var chosenRow)
                        ? new ResolvedManager(ManagerResolutionKind.SameImportRow, null, chosenRow, normalizedRef)
                        : null;
            if (decided is not null)
            {
                rows[i] = row with { Manager = decided };
                continue;
            }
            var issues = row.Issues.ToList();
            issues.Add(Issue(WorkforceIssueCodes.ManagerNotImported,
                "Their manager in this file isn't being imported.", "Manager", $"mgr:{normalizedRef}"));
            rows[i] = row with { Issues = issues };
        }
    }

    private static void DetectManagerCycles(List<ResolvedWorkforceRow> rows)
    {
        // Existing employees cannot report to people who do not exist yet, so a cycle can only form
        // among the rows being created.
        var byRow = rows.ToDictionary(r => r.SourceRowNumber);
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (row.Manager.Kind != ManagerResolutionKind.SameImportRow) continue;
            var seen = new HashSet<int> { row.SourceRowNumber };
            var current = row;
            while (current.Manager is { Kind: ManagerResolutionKind.SameImportRow, SameImportSourceRowNumber: int next }
                   && byRow.TryGetValue(next, out var nextRow))
            {
                if (!seen.Add(next))
                {
                    if (next == row.SourceRowNumber && !row.Issues.Any(x => x.Code is WorkforceIssueCodes.ManagerCycle or WorkforceIssueCodes.SelfManager))
                        rows[i] = row with { Issues = [.. row.Issues, Issue(WorkforceIssueCodes.ManagerCycle, "These reporting lines loop back to this person.", "Manager")] };
                    break;
                }
                current = nextRow;
            }
        }
    }

    private static WorkforceImportProposal Summarize(IReadOnlyList<ResolvedWorkforceRow> rows)
    {
        var finalized = rows.Select(row => row.Classification == WorkforceImportRowClassification.NotImported
            ? row
            : row with
            {
                Classification = row.HasBlocker
                    ? WorkforceImportRowClassification.Blocked
                    : row.MatchedEmployeeId is not null ? WorkforceImportRowClassification.Existing : WorkforceImportRowClassification.Create,
            }).ToList();

        return new WorkforceImportProposal(
            finalized,
            finalized.Count(r => r.Classification == WorkforceImportRowClassification.Create),
            finalized.Count(r => r.Classification == WorkforceImportRowClassification.Existing),
            finalized.Count(r => r.Classification == WorkforceImportRowClassification.Blocked),
            finalized.Count(r => r.Classification == WorkforceImportRowClassification.NotImported),
            finalized.Count(r => r.HasWarning && !r.HasBlocker));
    }

    // ---- helpers ----

    private static WorkforceIssue Issue(string code, string message, string field, string? key = null)
        => WorkforceImportIssueCatalog.Issue(code, message, field, key);

    private static WorkforceIssue SelfManager()
        => Issue(WorkforceIssueCodes.SelfManager, "An employee can't be their own manager.", "Manager");

    private static IReadOnlyDictionary<string, int> CountBy(IReadOnlyList<NormalizedWorkforceRow> rows, Func<NormalizedWorkforceRow, string?> selector)
    {
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var row in rows)
            if (selector(row) is { } key) counts[key] = counts.GetValueOrDefault(key) + 1;
        return counts;
    }

    private static IReadOnlyDictionary<string, NormalizedWorkforceRow> FirstByKey(
        IReadOnlyList<NormalizedWorkforceRow> rows, Func<NormalizedWorkforceRow, string?> selector)
    {
        var map = new Dictionary<string, NormalizedWorkforceRow>(StringComparer.Ordinal);
        foreach (var row in rows)
            if (selector(row) is { } key) map.TryAdd(key, row); // first occurrence wins; duplicates are blockers elsewhere
        return map;
    }

    private static string? Norm(string? value, Func<string, string> normalize)
        => string.IsNullOrWhiteSpace(value) ? null : normalize(value);

    private static string? FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));

    private static bool Differs(string? source, string? canonical)
        => !string.IsNullOrWhiteSpace(source) && !string.Equals(source.Trim(), canonical?.Trim(), StringComparison.OrdinalIgnoreCase);

    private static bool NameMateriallyDiffers(NormalizedWorkforceRow row, CanonicalEmployeeRef employee)
        => row.FirstName is not null && row.LastName is not null && !NameEquals(employee, row.FirstName, row.LastName);

    private static bool NameEquals(CanonicalEmployeeRef employee, string first, string last)
        => string.Equals(employee.FirstName?.Trim(), first.Trim(), StringComparison.OrdinalIgnoreCase)
           && string.Equals(employee.LastName?.Trim(), last.Trim(), StringComparison.OrdinalIgnoreCase);

    private static string JoinName(string? first, string? last)
        => string.Join(' ', new[] { first, last }.Where(s => !string.IsNullOrWhiteSpace(s)));

    private static string JoinList(IReadOnlyList<string> items)
        => items.Count <= 1 ? string.Concat(items) : $"{string.Join(", ", items.Take(items.Count - 1))} and {items[^1]}";

    /// <summary>The row's own canonical Employee id when it carries a resolvable Fusion reference, else Empty.</summary>
    private static Guid FusionSelf(NormalizedWorkforceRow row, WorkforceCanonicalSnapshot snapshot)
        => !string.IsNullOrWhiteSpace(row.FusionEmployeeReference)
           && Guid.TryParse(row.FusionEmployeeReference.Trim(), out var id)
           && snapshot.ByFusionId.ContainsKey(id)
            ? id
            : Guid.Empty;
}

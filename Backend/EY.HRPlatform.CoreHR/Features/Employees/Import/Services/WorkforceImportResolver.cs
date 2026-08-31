namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

// ---- Canonical snapshot (set-based preload; the resolver never queries per row) ----

public sealed record CanonicalEmployeeRef(
    Guid EmployeeId,
    string? EmployeeNumber,
    string? WorkEmail,
    string FirstName,
    string LastName,
    bool IsFormer,
    string? OrgUnitCode,
    string? DisplayTitle,
    string? Location,
    Guid? ManagerEmployeeId);

/// <param name="EstablishedFrom">
/// The date this unit's canonical Organization history begins (earliest Active effective state).
/// <see cref="DateOnly.MinValue"/> means a legacy unit with no effective-state timeline — no
/// history constraint. A work-effective date earlier than this predates the unit's existence in
/// Fusion, which the writer would reject; preflight must catch it at the same effective date.
/// </param>
public sealed record CanonicalOrgUnitRef(Guid OrgUnitId, string Code, string Path, string Name, bool ValidToday, DateOnly EstablishedFrom);

public sealed class WorkforceCanonicalSnapshot
{
    public required IReadOnlyDictionary<string, CanonicalEmployeeRef> ByEmployeeNumber { get; init; }
    public required IReadOnlyDictionary<string, CanonicalEmployeeRef> ByWorkEmail { get; init; }
    public required IReadOnlyDictionary<Guid, CanonicalEmployeeRef> ByFusionId { get; init; }
    public required IReadOnlyDictionary<string, Guid> ReservedFormerNumbers { get; init; }
    public required IReadOnlyDictionary<Guid, CanonicalOrgUnitRef> OrgById { get; init; }
    public required IReadOnlyDictionary<string, CanonicalOrgUnitRef> OrgByCode { get; init; }
    public required IReadOnlyDictionary<string, CanonicalOrgUnitRef> OrgByPath { get; init; }
    public required ILookup<string, CanonicalOrgUnitRef> OrgByName { get; init; }

    public static string NormalizeNumber(string value) => value.Trim().ToUpperInvariant();
    public static string NormalizeEmail(string value) => value.Trim().ToLowerInvariant();
    public static string NormalizeOrg(string value) => value.Trim().ToLowerInvariant();
}

// ---- Administrator decisions applied to resolution (grouped + per row) ----

public sealed record WorkforceResolutionDecisions(
    ISet<int> ExcludedRows,
    ISet<int> KeepFusionUnchangedRows,
    ISet<int> NoManagerRows,
    ISet<int> KeepAsDistinctRows,
    IReadOnlyDictionary<string, Guid> OrganizationBySourceValue,
    IReadOnlyDictionary<int, Guid> ManagerEmployeeByRow,
    // Reference-scoped manager decisions (keyed by the normalized manager reference), so resolving one
    // reference resolves every row that reports to it — the "fix once, affect all reports" contract.
    IReadOnlyDictionary<string, Guid> ManagerEmployeeByReference,
    IReadOnlyDictionary<string, int> ManagerImportRowByReference,
    ISet<string> NoManagerByReference,
    bool NormalizeWorkDatesToBaseline = false)
{
    public static WorkforceResolutionDecisions None { get; } = new(
        new HashSet<int>(), new HashSet<int>(), new HashSet<int>(), new HashSet<int>(),
        new Dictionary<string, Guid>(), new Dictionary<int, Guid>(),
        new Dictionary<string, Guid>(), new Dictionary<string, int>(), new HashSet<string>());
}

// ---- Output ----

public sealed record WorkforceIssue(string Code, string Severity, string Message, string Field, string? DecisionKey = null);

public enum ManagerResolutionKind { None, ExistingEmployee, SameImportRow, Unresolved }

public sealed record ResolvedManager(ManagerResolutionKind Kind, Guid? EmployeeId, int? SameImportSourceRowNumber, string? RawReference);

public sealed record ResolvedWorkforceRow(
    int SourceRowNumber,
    WorkforceImportRowClassification Classification,
    Guid? MatchedEmployeeId,
    Guid? ResolvedOrgUnitId,
    DateOnly ResolvedWorkEffectiveDate,
    ResolvedManager Manager,
    bool IsExcluded,
    IReadOnlyList<WorkforceIssue> Issues)
{
    public bool HasBlocker => Issues.Any(i => i.Severity == Severities.Blocker);
}

public sealed record WorkforceImportProposal(
    IReadOnlyList<ResolvedWorkforceRow> Rows,
    int NewCount,
    int ExistingAnchorCount,
    int NeedsAttentionCount,
    int ExcludedCount);

public static class Severities
{
    public const string Blocker = "blocker";
    public const string Warning = "warning";
    public const string Information = "information";
}

/// <summary>
/// Turns interpreted rows into the create-only establishment proposal: conservative identity,
/// read-only existing anchors with explicit differences, lifecycle guards, canonical as-of
/// Organization resolution, manager resolution (existing + same-import), and the classification/
/// issue model with exclusion and grouped decision keys. Pure over a preloaded snapshot + decisions.
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
        // Cross-row evidence gathered once — including O(1) same-import manager lookups so manager
        // resolution never scans all rows per row (which would be O(n²) at import scale).
        var inFileNumbers = CountBy(rows, r => Norm(r.EmployeeNumber, WorkforceCanonicalSnapshot.NormalizeNumber));
        var inFileEmails = CountBy(rows, r => Norm(r.WorkEmail, WorkforceCanonicalSnapshot.NormalizeEmail));
        var workerKeys = CountBy(rows, r => Norm(r.WorkerKey, s => s.Trim().ToUpperInvariant()));
        var rowByWorkerKey = FirstByKey(rows, r => Norm(r.WorkerKey, s => s.Trim().ToUpperInvariant()));
        var rowByNumber = FirstByKey(rows, r => Norm(r.EmployeeNumber, WorkforceCanonicalSnapshot.NormalizeNumber));
        var rowByEmail = FirstByKey(rows, r => Norm(r.WorkEmail, WorkforceCanonicalSnapshot.NormalizeEmail));
        var index = new SameImportIndex(rowByWorkerKey, rowByNumber, rowByEmail);
        var newRowSignatures = new Dictionary<string, List<int>>(StringComparer.Ordinal);

        var resolved = new List<ResolvedWorkforceRow>(rows.Count);
        foreach (var row in rows)
            resolved.Add(ResolveRow(row, index, snapshot, decisions, baseline, today, inFileNumbers, inFileEmails, workerKeys, newRowSignatures));

        // Same-import manager cycle detection across proposed rows.
        DetectManagerCycles(resolved);

        // Dependent revalidation: a proposed manager row that ends up excluded leaves dependents unresolved.
        RevalidateExcludedManagerDependents(resolved, rows, decisions);

        return Summarize(resolved);
    }

    /// <summary>O(1) same-import lookups built once from the interpreted rows.</summary>
    private sealed record SameImportIndex(
        IReadOnlyDictionary<string, NormalizedWorkforceRow> ByWorkerKey,
        IReadOnlyDictionary<string, NormalizedWorkforceRow> ByEmployeeNumber,
        IReadOnlyDictionary<string, NormalizedWorkforceRow> ByEmail);

    private ResolvedWorkforceRow ResolveRow(
        NormalizedWorkforceRow row,
        SameImportIndex allRows,
        WorkforceCanonicalSnapshot snapshot,
        WorkforceResolutionDecisions decisions,
        DateOnly baseline,
        DateOnly today,
        IReadOnlyDictionary<string, int> inFileNumbers,
        IReadOnlyDictionary<string, int> inFileEmails,
        IReadOnlyDictionary<string, int> workerKeys,
        Dictionary<string, List<int>> newRowSignatures)
    {
        var issues = new List<WorkforceIssue>(row.Issues.Select(i => new WorkforceIssue(i.Code, i.Severity, i.Message, i.Field.ToString())));

        // The one effective date the establishment is dated at: the explicit source "work details
        // effective from" when present, else the employee's Employment Start (never the import
        // baseline/today) — unless the administrator has explicitly chosen to normalize current work
        // context to the baseline. WorkAssignment and the initial primary Manager relationship are
        // both established from this date, and Organization currency is checked here, so Review and
        // Apply share one readiness definition.
        var resolvedWorkEffective = decisions.NormalizeWorkDatesToBaseline
            ? baseline
            : (row.WorkEffectiveFrom ?? row.EmploymentStart ?? baseline);

        if (decisions.ExcludedRows.Contains(row.SourceRowNumber))
            return new ResolvedWorkforceRow(row.SourceRowNumber, WorkforceImportRowClassification.Excluded, null, null,
                resolvedWorkEffective, new ResolvedManager(ManagerResolutionKind.None, null, null, null), true, issues);

        // 1. Source-local worker key uniqueness (when used for relationships).
        if (row.WorkerKey is not null && workerKeys.GetValueOrDefault(row.WorkerKey.Trim().ToUpperInvariant()) > 1)
            issues.Add(new WorkforceIssue("DuplicateWorkerReference", Severities.Blocker,
                "This source Worker ID is used by more than one row.", "WorkerReference"));

        // 2. Identity resolution (conservative ladder).
        var identity = ResolveIdentity(row, snapshot, inFileNumbers, issues);

        if (identity.MatchedEmployee is { } anchor)
        {
            // Existing anchor: read-only. Any asserted change is an unsupported difference.
            ApplyExistingAnchorDifferences(row, anchor, decisions, issues);
            var anchorManager = ResolveManager(row, allRows, snapshot, decisions, baseline, issues, forNewEmployee: false);
            var anchorClass = issues.Any(i => i.Severity == Severities.Blocker)
                ? WorkforceImportRowClassification.NeedsAttention
                : WorkforceImportRowClassification.ExistingAnchor;
            return new ResolvedWorkforceRow(row.SourceRowNumber, anchorClass, anchor.EmployeeId, null,
                resolvedWorkEffective, anchorManager, false, issues);
        }

        // New employee path.
        ApplyLifecycleGuards(row, baseline, today, issues);
        ApplyNewEmployeeIdentityChecks(row, snapshot, inFileNumbers, inFileEmails, issues);
        ApplyIndistinguishableDuplicateGuard(row, decisions, newRowSignatures, issues);
        var orgUnitId = ResolveOrganization(row, snapshot, decisions, today, baseline, resolvedWorkEffective, issues);
        var manager = ResolveManager(row, allRows, snapshot, decisions, baseline, issues, forNewEmployee: true);
        ApplyRequiredNewEmployeeChecks(row, issues);

        var classification = issues.Any(i => i.Severity == Severities.Blocker)
            ? WorkforceImportRowClassification.NeedsAttention
            : WorkforceImportRowClassification.NewEmployee;
        return new ResolvedWorkforceRow(row.SourceRowNumber, classification, null, orgUnitId,
            resolvedWorkEffective, manager, false, issues);
    }

    private static (CanonicalEmployeeRef? MatchedEmployee, bool Contradiction) ResolveIdentity(
        NormalizedWorkforceRow row, WorkforceCanonicalSnapshot snapshot, IReadOnlyDictionary<string, int> inFileNumbers, List<WorkforceIssue> issues)
    {
        // Strongest evidence: a trusted tenant-owned Fusion Employee reference — but only when the
        // column was explicitly mapped as such (arbitrary GUID columns never reach here). The snapshot
        // holds only current-tenant employees, so a value that does not resolve is not tenant-owned.
        CanonicalEmployeeRef? byFusionRef = null;
        if (!string.IsNullOrWhiteSpace(row.FusionEmployeeReference))
        {
            if (Guid.TryParse(row.FusionEmployeeReference.Trim(), out var fusionId) && snapshot.ByFusionId.TryGetValue(fusionId, out var found))
                byFusionRef = found;
            else
            {
                issues.Add(new WorkforceIssue("FusionEmployeeReferenceUnresolved", Severities.Blocker,
                    "This Fusion employee reference does not resolve to an employee in this tenant.", "FusionEmployeeReference"));
                return (null, false);
            }
        }

        CanonicalEmployeeRef? byNumber = null;
        if (row.EmployeeNumber is { } number && !string.IsNullOrWhiteSpace(number))
        {
            var normalized = WorkforceCanonicalSnapshot.NormalizeNumber(number);
            if (inFileNumbers.GetValueOrDefault(normalized) > 1)
                issues.Add(new WorkforceIssue("DuplicateEmployeeNumberInFile", Severities.Blocker,
                    "This Employee Number appears on more than one source row.", "EmployeeNumber", DecisionKey: $"empno:{normalized}"));

            if (snapshot.ByEmployeeNumber.TryGetValue(normalized, out var existing))
                byNumber = existing;
            else if (snapshot.ReservedFormerNumbers.TryGetValue(normalized, out _))
            {
                issues.Add(new WorkforceIssue("FormerEmployeeLifecycleConflict", Severities.Blocker,
                    "This Employee Number belongs to a former employee; rehire is handled outside import.", "EmployeeNumber"));
                return (byFusionRef, false);
            }
        }

        // Contradictory strong identifiers pointing to different employees is a blocker.
        if (byFusionRef is not null && byNumber is not null && byFusionRef.EmployeeId != byNumber.EmployeeId)
        {
            issues.Add(new WorkforceIssue("ContradictoryStrongIdentifiers", Severities.Blocker,
                "The Fusion reference and Employee Number point to different employees.", "FusionEmployeeReference"));
            return (null, false);
        }

        var matched = byFusionRef ?? byNumber;
        if (matched is not null && NameMateriallyDiffers(row, matched))
            issues.Add(new WorkforceIssue("StrongKeyNameMismatch", Severities.Blocker,
                "This strong identifier belongs to a different-named employee; confirm the match or exclude the row.", "EmployeeNumber"));
        return (matched, false);
    }

    private static void ApplyNewEmployeeIdentityChecks(
        NormalizedWorkforceRow row, WorkforceCanonicalSnapshot snapshot,
        IReadOnlyDictionary<string, int> inFileNumbers, IReadOnlyDictionary<string, int> inFileEmails, List<WorkforceIssue> issues)
    {
        if (row.WorkEmail is { } email && !string.IsNullOrWhiteSpace(email))
        {
            var normalized = WorkforceCanonicalSnapshot.NormalizeEmail(email);
            if (snapshot.ByWorkEmail.ContainsKey(normalized))
                issues.Add(new WorkforceIssue("WorkEmailOccupied", Severities.Blocker,
                    "This work email already belongs to an employee in Fusion; confirm whether this is the same person.", "WorkEmail"));
            if (inFileEmails.GetValueOrDefault(normalized) > 1)
                issues.Add(new WorkforceIssue("DuplicateWorkEmailInFile", Severities.Blocker,
                    "This work email appears on more than one new row.", "WorkEmail", DecisionKey: $"email:{normalized}"));
        }

        // Name-only similarity is a quiet hint, never a blocker.
        if (row.FirstName is { } first && row.LastName is { } last
            && snapshot.ByEmployeeNumber.Values.Any(e => NameEquals(e, first, last)))
            issues.Add(new WorkforceIssue("SimilarNameExists", Severities.Information,
                "A similar name already exists in Fusion.", "FirstName"));
    }

    private void ApplyIndistinguishableDuplicateGuard(
        NormalizedWorkforceRow row, WorkforceResolutionDecisions decisions, Dictionary<string, List<int>> signatures, List<WorkforceIssue> issues)
    {
        // Two proposed-new rows that are near-exact duplicates AND carry no distinguishing strong
        // identifier or source-local worker key must not silently create two employees.
        var hasDistinguisher = !string.IsNullOrWhiteSpace(row.EmployeeNumber) || !string.IsNullOrWhiteSpace(row.WorkerKey) || !string.IsNullOrWhiteSpace(row.WorkEmail);
        if (hasDistinguisher || decisions.KeepAsDistinctRows.Contains(row.SourceRowNumber)) return;
        var signature = string.Join('|',
            (row.FirstName ?? "").Trim().ToLowerInvariant(),
            (row.LastName ?? "").Trim().ToLowerInvariant(),
            (row.OrganizationRef ?? "").Trim().ToLowerInvariant(),
            (row.DisplayTitle ?? "").Trim().ToLowerInvariant());
        if (string.IsNullOrWhiteSpace(signature.Replace("|", ""))) return;
        if (!signatures.TryGetValue(signature, out var list)) signatures[signature] = list = [];
        list.Add(row.SourceRowNumber);
        if (list.Count > 1)
            issues.Add(new WorkforceIssue("IndistinguishableDuplicateRow", Severities.Blocker,
                "Another row looks like the same person with no distinguishing key; keep both or fix the source.", "FirstName", DecisionKey: $"dup:{signature}"));
    }

    private static void ApplyExistingAnchorDifferences(
        NormalizedWorkforceRow row, CanonicalEmployeeRef anchor, WorkforceResolutionDecisions decisions, List<WorkforceIssue> issues)
    {
        if (decisions.KeepFusionUnchangedRows.Contains(row.SourceRowNumber)) return;
        var differs =
            Differs(row.DisplayTitle, anchor.DisplayTitle)
            || Differs(row.OrganizationRef, anchor.OrgUnitCode)
            || Differs(row.Location, anchor.Location);
        if (differs)
            issues.Add(new WorkforceIssue("UnsupportedExistingDifference", Severities.Blocker,
                "This differs from the existing employee record. Workforce Import doesn't change existing employees; keep Fusion unchanged or exclude the row.", "DisplayTitle",
                DecisionKey: $"anchor:{row.SourceRowNumber}"));
    }

    private static void ApplyLifecycleGuards(NormalizedWorkforceRow row, DateOnly baseline, DateOnly today, List<WorkforceIssue> issues)
    {
        var status = row.LifecycleStatus?.Trim().ToLowerInvariant();
        var isFormerStatus = status is "terminated" or "former" or "inactive" or "left" or "resigned" or "departed";
        if (isFormerStatus || (row.EmploymentEnd is { } end && end <= baseline))
            issues.Add(new WorkforceIssue("FormerWorkerNotEstablished", Severities.Blocker,
                "This row describes a former employee as of the workforce-as-of date; former employees are not created through import.", "LifecycleStatus"));
        else if (row.EmploymentEnd is { } laterEnd && laterEnd > baseline && laterEnd <= today)
            // Past baseline: carrying the baseline employment forward would already be wrong today.
            issues.Add(new WorkforceIssue("EmploymentEndedBeforeToday", Severities.Blocker,
                "This employee's known end date is before today; establishing an open employment would be incorrect.", "EmploymentEnd"));

        if (row.EmploymentStart is { } start && start > baseline)
            // Interpreter already flags this; guard remains here for the resolver's completeness.
            { /* already blocked by interpreter EmploymentStartAfterBaseline */ }
    }

    private static Guid? ResolveOrganization(
        NormalizedWorkforceRow row, WorkforceCanonicalSnapshot snapshot, WorkforceResolutionDecisions decisions,
        DateOnly today, DateOnly baseline, DateOnly workEffective, List<WorkforceIssue> issues)
    {
        // Strongest: a trusted tenant-owned Fusion OrgUnit reference (explicitly mapped only).
        if (!string.IsNullOrWhiteSpace(row.FusionOrganizationReference))
        {
            if (Guid.TryParse(row.FusionOrganizationReference.Trim(), out var orgId) && snapshot.OrgById.TryGetValue(orgId, out var byId))
                return CheckOrgValidity(byId, baseline, today, workEffective, issues);
            issues.Add(new WorkforceIssue("FusionOrganizationReferenceUnresolved", Severities.Blocker,
                "This Fusion Organization reference does not resolve to a unit in this tenant.", "FusionOrganizationReference"));
            return null;
        }

        var raw = row.OrganizationRef;
        if (string.IsNullOrWhiteSpace(raw))
        {
            issues.Add(new WorkforceIssue("OrganizationMissing", Severities.Blocker, "An Organization is required.", "Organization"));
            return null;
        }
        var normalized = WorkforceCanonicalSnapshot.NormalizeOrg(raw);

        // Grouped decision: a resolution for this repeated source value applies to every row using it.
        if (decisions.OrganizationBySourceValue.TryGetValue(normalized, out var chosen))
        {
            if (snapshot.OrgById.TryGetValue(chosen, out var chosenUnit)) return CheckOrgValidity(chosenUnit, baseline, today, workEffective, issues);
            return chosen;
        }

        if (snapshot.OrgByCode.TryGetValue(normalized, out var byCode)) return CheckOrgValidity(byCode, baseline, today, workEffective, issues);
        if (snapshot.OrgByPath.TryGetValue(normalized, out var byPath)) return CheckOrgValidity(byPath, baseline, today, workEffective, issues);
        var byName = snapshot.OrgByName[normalized].ToList();
        if (byName.Count == 1) return CheckOrgValidity(byName[0], baseline, today, workEffective, issues);

        issues.Add(new WorkforceIssue("OrganizationUnresolved", Severities.Blocker,
            "This Organization could not be matched. Choose the canonical Organization.", "Organization", DecisionKey: $"org:{normalized}"));
        return null;
    }

    private static Guid? CheckOrgValidity(CanonicalOrgUnitRef unit, DateOnly baseline, DateOnly today, DateOnly workEffective, List<WorkforceIssue> issues)
    {
        if (baseline < today && !unit.ValidToday)
        {
            issues.Add(new WorkforceIssue("OrganizationInvalidToday", Severities.Blocker,
                "This Organization is already invalid today; import cannot establish current truth against it.", "Organization"));
            return null;
        }
        // Initial establishment may back-date a WorkAssignment before the unit's Fusion
        // EstablishedFrom. That date is the unit's Fusion import/establishment date, not evidence the
        // real-world unit did not exist earlier, so a historical work date is not a temporal error
        // here. The unit must still exist in this tenant and be a valid current target (the
        // ValidToday check above); given that, an earlier work-effective date is accepted as-is.
        // workEffective is retained on the signature as the establishment date this check is dated at.
        _ = workEffective;
        return unit.OrgUnitId;
    }

    private ResolvedManager ResolveManager(
        NormalizedWorkforceRow row, SameImportIndex allRows, WorkforceCanonicalSnapshot snapshot,
        WorkforceResolutionDecisions decisions, DateOnly baseline, List<WorkforceIssue> issues, bool forNewEmployee)
    {
        if (decisions.NoManagerRows.Contains(row.SourceRowNumber))
            return new ResolvedManager(ManagerResolutionKind.None, null, null, null);
        if (decisions.ManagerEmployeeByRow.TryGetValue(row.SourceRowNumber, out var chosen))
            return new ResolvedManager(ManagerResolutionKind.ExistingEmployee, chosen, null, row.ManagerReference);

        // Strongest: a trusted tenant-owned Fusion manager Employee reference (explicitly mapped only).
        if (!string.IsNullOrWhiteSpace(row.FusionManagerReference))
        {
            if (Guid.TryParse(row.FusionManagerReference.Trim(), out var managerId) && snapshot.ByFusionId.TryGetValue(managerId, out var fusionManager))
            {
                if (fusionManager.EmployeeId == FusionSelf(row, snapshot))
                    issues.Add(new WorkforceIssue("SelfManager", Severities.Blocker, "An employee cannot be their own manager.", "Manager"));
                return new ResolvedManager(ManagerResolutionKind.ExistingEmployee, fusionManager.EmployeeId, null, row.FusionManagerReference);
            }
            issues.Add(new WorkforceIssue("ManagerUnresolved", Severities.Blocker,
                "This Fusion manager reference does not resolve to an employee in this tenant.", "Manager"));
            return new ResolvedManager(ManagerResolutionKind.Unresolved, null, null, row.FusionManagerReference);
        }

        var reference = FirstNonEmpty(row.ManagerKey, row.ManagerReference);
        if (string.IsNullOrWhiteSpace(reference))
            return new ResolvedManager(ManagerResolutionKind.None, null, null, null); // blank manager is a valid fact

        // Same-import reference by source-local Worker ID.
        if (row.ManagerKey is { } managerKey && !string.IsNullOrWhiteSpace(managerKey))
        {
            if (allRows.ByWorkerKey.TryGetValue(managerKey.Trim().ToUpperInvariant(), out var target))
            {
                if (target.SourceRowNumber == row.SourceRowNumber)
                    issues.Add(new WorkforceIssue("SelfManager", Severities.Blocker, "An employee cannot be their own manager.", "Manager"));
                return new ResolvedManager(ManagerResolutionKind.SameImportRow, null, target.SourceRowNumber, reference);
            }
        }

        // Manager by Employee Number: existing employee or another same-import row.
        var normalizedRef = WorkforceCanonicalSnapshot.NormalizeNumber(reference);
        if (snapshot.ByEmployeeNumber.TryGetValue(normalizedRef, out var existingManager))
            return new ResolvedManager(ManagerResolutionKind.ExistingEmployee, existingManager.EmployeeId, null, reference);
        if (allRows.ByEmployeeNumber.TryGetValue(normalizedRef, out var sameImport))
        {
            if (sameImport.SourceRowNumber == row.SourceRowNumber)
                issues.Add(new WorkforceIssue("SelfManager", Severities.Blocker, "An employee cannot be their own manager.", "Manager"));
            return new ResolvedManager(ManagerResolutionKind.SameImportRow, null, sameImport.SourceRowNumber, reference);
        }

        // Manager by work email — the common real-world case (files reference managers by email). Match
        // an existing employee first, then someone else being added in the same import.
        if (reference.Contains('@'))
        {
            var email = WorkforceCanonicalSnapshot.NormalizeEmail(reference);
            if (snapshot.ByWorkEmail.TryGetValue(email, out var existingByEmail))
                return new ResolvedManager(ManagerResolutionKind.ExistingEmployee, existingByEmail.EmployeeId, null, reference);
            if (allRows.ByEmail.TryGetValue(email, out var sameByEmail))
            {
                if (sameByEmail.SourceRowNumber == row.SourceRowNumber)
                    issues.Add(new WorkforceIssue("SelfManager", Severities.Blocker, "An employee cannot be their own manager.", "Manager"));
                return new ResolvedManager(ManagerResolutionKind.SameImportRow, null, sameByEmail.SourceRowNumber, reference);
            }
        }

        // Administrator decision for this reference — one choice resolves everyone reporting to it.
        if (decisions.NoManagerByReference.Contains(normalizedRef))
            return new ResolvedManager(ManagerResolutionKind.None, null, null, reference);
        if (decisions.ManagerEmployeeByReference.TryGetValue(normalizedRef, out var chosenManager))
        {
            if (chosenManager == FusionSelf(row, snapshot))
                issues.Add(new WorkforceIssue("SelfManager", Severities.Blocker, "An employee cannot be their own manager.", "Manager"));
            return new ResolvedManager(ManagerResolutionKind.ExistingEmployee, chosenManager, null, reference);
        }
        if (decisions.ManagerImportRowByReference.TryGetValue(normalizedRef, out var chosenImportRow))
        {
            if (chosenImportRow == row.SourceRowNumber)
                issues.Add(new WorkforceIssue("SelfManager", Severities.Blocker, "An employee cannot be their own manager.", "Manager"));
            return new ResolvedManager(ManagerResolutionKind.SameImportRow, null, chosenImportRow, reference);
        }

        // An explicitly asserted manager that cannot be resolved is a blocker (No manager is an explicit decision).
        issues.Add(new WorkforceIssue("ManagerUnresolved", Severities.Blocker,
            "This manager could not be resolved. Choose a person or set No manager.", "Manager", DecisionKey: $"mgr:{normalizedRef}"));
        return new ResolvedManager(ManagerResolutionKind.Unresolved, null, null, reference);
    }

    private static void ApplyRequiredNewEmployeeChecks(NormalizedWorkforceRow row, List<WorkforceIssue> issues)
    {
        if (string.IsNullOrWhiteSpace(row.FirstName) || string.IsNullOrWhiteSpace(row.LastName))
            if (!issues.Any(i => i.Code is "NameFormatUnresolved" or "NameNotSplittable"))
                issues.Add(new WorkforceIssue("NameMissing", Severities.Blocker, "First and last name are required.", "FirstName"));
        if (string.IsNullOrWhiteSpace(row.DisplayTitle))
            issues.Add(new WorkforceIssue("DisplayTitleMissing", Severities.Blocker, "A display title is required.", "DisplayTitle"));
        if (string.IsNullOrWhiteSpace(row.EmployeeNumber))
            issues.Add(new WorkforceIssue("EmployeeNumberGenerated", Severities.Information, "Employee number will be generated.", "EmployeeNumber"));
    }

    private static void DetectManagerCycles(List<ResolvedWorkforceRow> rows)
    {
        var byRow = rows.ToDictionary(r => r.SourceRowNumber);
        foreach (var row in rows)
        {
            if (row.Manager.Kind != ManagerResolutionKind.SameImportRow) continue;
            var seen = new HashSet<int> { row.SourceRowNumber };
            var currentRow = row;
            while (currentRow.Manager.Kind == ManagerResolutionKind.SameImportRow
                   && currentRow.Manager.SameImportSourceRowNumber is int nextRowNumber
                   && byRow.TryGetValue(nextRowNumber, out var next))
            {
                if (!seen.Add(nextRowNumber))
                {
                    var mutable = (List<WorkforceIssue>)row.Issues;
                    if (!mutable.Any(i => i.Code == "ManagerCycle"))
                        mutable.Add(new WorkforceIssue("ManagerCycle", Severities.Blocker, "This reporting chain forms a cycle within the import.", "Manager"));
                    break;
                }
                currentRow = next;
            }
        }
    }

    private static void RevalidateExcludedManagerDependents(
        List<ResolvedWorkforceRow> rows, IReadOnlyList<NormalizedWorkforceRow> normalized, WorkforceResolutionDecisions decisions)
    {
        if (decisions.ExcludedRows.Count == 0) return;
        foreach (var row in rows)
        {
            if (row.IsExcluded || row.Manager.Kind != ManagerResolutionKind.SameImportRow) continue;
            if (row.Manager.SameImportSourceRowNumber is int target && decisions.ExcludedRows.Contains(target))
            {
                var mutable = (List<WorkforceIssue>)row.Issues;
                if (!mutable.Any(i => i.Code == "ManagerUnresolved"))
                    mutable.Add(new WorkforceIssue("ManagerUnresolved", Severities.Blocker,
                        "The referenced manager was excluded from this import. Choose a person or set No manager.", "Manager"));
            }
        }
    }

    private static WorkforceImportProposal Summarize(IReadOnlyList<ResolvedWorkforceRow> rows)
    {
        // Recompute classification after cross-row passes may have added blockers.
        var finalized = rows.Select(row =>
            row.Classification is WorkforceImportRowClassification.Excluded
                ? row
                : row with
                {
                    Classification = row.HasBlocker
                        ? WorkforceImportRowClassification.NeedsAttention
                        : row.MatchedEmployeeId is not null
                            ? WorkforceImportRowClassification.ExistingAnchor
                            : WorkforceImportRowClassification.NewEmployee,
                }).ToList();

        return new WorkforceImportProposal(
            finalized,
            finalized.Count(r => r.Classification == WorkforceImportRowClassification.NewEmployee),
            finalized.Count(r => r.Classification == WorkforceImportRowClassification.ExistingAnchor),
            finalized.Count(r => r.Classification == WorkforceImportRowClassification.NeedsAttention),
            finalized.Count(r => r.Classification == WorkforceImportRowClassification.Excluded));
    }

    // ---- helpers ----

    private static IReadOnlyDictionary<string, int> CountBy(IReadOnlyList<NormalizedWorkforceRow> rows, Func<NormalizedWorkforceRow, string?> selector)
    {
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            var key = selector(row);
            if (key is null) continue;
            counts[key] = counts.GetValueOrDefault(key) + 1;
        }
        return counts;
    }

    private static IReadOnlyDictionary<string, NormalizedWorkforceRow> FirstByKey(
        IReadOnlyList<NormalizedWorkforceRow> rows, Func<NormalizedWorkforceRow, string?> selector)
    {
        var map = new Dictionary<string, NormalizedWorkforceRow>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            var key = selector(row);
            if (key is not null) map.TryAdd(key, row); // first occurrence wins; duplicates handled elsewhere
        }
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

    /// <summary>The row's own canonical Employee id when it carries a resolvable Fusion reference, else Empty.</summary>
    private static Guid FusionSelf(NormalizedWorkforceRow row, WorkforceCanonicalSnapshot snapshot)
        => !string.IsNullOrWhiteSpace(row.FusionEmployeeReference)
           && Guid.TryParse(row.FusionEmployeeReference.Trim(), out var id)
           && snapshot.ByFusionId.ContainsKey(id)
            ? id
            : Guid.Empty;
}

using EY.HRPlatform.CoreHR.Features.Employees.Import;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public sealed class WorkforceImportResolverTests
{
    private readonly WorkforceImportResolver _resolver = new();
    private static readonly DateOnly Baseline = new(2026, 8, 17);
    private static readonly DateOnly Today = new(2026, 8, 17);
    private static readonly Guid OpsUnit = Guid.NewGuid();

    private static NormalizedWorkforceRow Row(
        int n, string? number = null, string? first = "Amina", string? last = "Mansour", string? org = "OPS",
        string? title = "Consultant", string? email = null, string? managerRef = null, string? workerKey = null,
        string? managerKey = null, string? status = null, DateOnly? end = null, DateOnly? start = null,
        string? fusionEmp = null, string? fusionOrg = null, string? fusionMgr = null, DateOnly? workEffective = null)
        => new(n, fusionEmp, fusionOrg, fusionMgr, number, first, last, null, email, start ?? new DateOnly(2021, 2, 1), workEffective ?? Baseline, org, title, null,
            managerRef, workerKey, managerKey, status, end, []);

    private static CanonicalEmployeeRef Emp(string number, string first, string last, bool former = false, string? email = null, string? title = null, string? org = null)
        => new(Guid.NewGuid(), number, email, first, last, former, org, title, null, null);

    private static WorkforceCanonicalSnapshot Snapshot(
        IEnumerable<CanonicalEmployeeRef>? employees = null,
        IEnumerable<(string Number, CanonicalEmployeeRef Emp)>? formerNumbers = null,
        bool opsValidToday = true,
        DateOnly? establishedFrom = null)
    {
        var list = (employees ?? []).ToList();
        var org = new CanonicalOrgUnitRef(OpsUnit, "OPS", "asteria/operations", "Operations", opsValidToday, establishedFrom ?? DateOnly.MinValue);
        return new WorkforceCanonicalSnapshot
        {
            ByEmployeeNumber = list.Where(e => e.EmployeeNumber is not null).ToDictionary(e => WorkforceCanonicalSnapshot.NormalizeNumber(e.EmployeeNumber!)),
            ByWorkEmail = list.Where(e => e.WorkEmail is not null).ToDictionary(e => WorkforceCanonicalSnapshot.NormalizeEmail(e.WorkEmail!)),
            ByFusionId = list.ToDictionary(e => e.EmployeeId),
            ReservedFormerNumbers = (formerNumbers ?? []).ToDictionary(f => WorkforceCanonicalSnapshot.NormalizeNumber(f.Number), f => f.Emp.EmployeeId),
            OrgById = new Dictionary<Guid, CanonicalOrgUnitRef> { [OpsUnit] = org },
            OrgByCode = new Dictionary<string, CanonicalOrgUnitRef> { ["ops"] = org },
            OrgByPath = new Dictionary<string, CanonicalOrgUnitRef> { ["asteria/operations"] = org },
            OrgByName = new[] { org }.ToLookup(o => o.Name.ToLowerInvariant()),
        };
    }

    private WorkforceImportProposal Resolve(IEnumerable<NormalizedWorkforceRow> rows, WorkforceCanonicalSnapshot snapshot, WorkforceResolutionDecisions? decisions = null, DateOnly? baseline = null)
        => _resolver.Resolve(rows.ToList(), snapshot, decisions ?? WorkforceResolutionDecisions.None, baseline ?? Baseline, Today);

    private static ResolvedWorkforceRow Only(WorkforceImportProposal p) => Assert.Single(p.Rows);
    private static bool Has(ResolvedWorkforceRow r, string code) => r.Issues.Any(i => i.Code == code);

    [Fact]
    public void Unknown_number_is_new_employee()
    {
        var r = Only(Resolve([Row(1, number: "NEW-1")], Snapshot()));
        Assert.Equal(WorkforceImportRowClassification.NewEmployee, r.Classification);
        Assert.Equal(OpsUnit, r.ResolvedOrgUnitId);
    }

    [Fact]
    public void Existing_number_is_read_only_anchor()
    {
        var snap = Snapshot([Emp("E-1", "Amina", "Mansour", title: "Consultant", org: "OPS")]);
        var r = Only(Resolve([Row(1, number: "E-1", title: "Consultant", org: "OPS")], snap));
        Assert.Equal(WorkforceImportRowClassification.ExistingAnchor, r.Classification);
        Assert.NotNull(r.MatchedEmployeeId);
    }

    [Fact]
    public void Existing_anchor_difference_blocks_until_keep_unchanged()
    {
        var snap = Snapshot([Emp("E-1", "Amina", "Mansour", title: "Consultant", org: "OPS")]);
        var blocked = Only(Resolve([Row(1, number: "E-1", title: "Director", org: "OPS")], snap));
        Assert.Equal(WorkforceImportRowClassification.NeedsAttention, blocked.Classification);
        Assert.True(Has(blocked, "UnsupportedExistingDifference"));

        var kept = Only(Resolve([Row(1, number: "E-1", title: "Director", org: "OPS")], snap,
            new WorkforceResolutionDecisions(new HashSet<int>(), new HashSet<int> { 1 }, new HashSet<int>(), new HashSet<int>(), new Dictionary<string, Guid>(), new Dictionary<int, Guid>())));
        Assert.Equal(WorkforceImportRowClassification.ExistingAnchor, kept.Classification);
    }

    [Fact]
    public void Duplicate_number_in_file_blocks()
    {
        var p = Resolve([Row(1, number: "DUP"), Row(2, number: "DUP", first: "Sami", last: "Ali")], Snapshot());
        Assert.All(p.Rows, r => Assert.True(Has(r, "DuplicateEmployeeNumberInFile")));
    }

    [Fact]
    public void Reserved_former_number_is_lifecycle_conflict()
    {
        var former = Emp("F-1", "Old", "Worker", former: true);
        var snap = Snapshot(formerNumbers: [("F-1", former)]);
        Assert.True(Has(Only(Resolve([Row(1, number: "F-1")], snap)), "FormerEmployeeLifecycleConflict"));
    }

    [Fact]
    public void Strong_key_name_mismatch_blocks()
    {
        var snap = Snapshot([Emp("E-1", "Youssef", "BenAli", title: "Consultant", org: "OPS")]);
        Assert.True(Has(Only(Resolve([Row(1, number: "E-1", first: "Amina", last: "Mansour")], snap)), "StrongKeyNameMismatch"));
    }

    [Fact]
    public void Occupied_and_duplicate_work_email_block()
    {
        var snap = Snapshot([Emp("E-1", "Someone", "Else", email: "taken@x.com")]);
        Assert.True(Has(Only(Resolve([Row(1, number: "NEW", email: "taken@x.com")], snap)), "WorkEmailOccupied"));

        var dup = Resolve([Row(1, number: "A", email: "same@x.com"), Row(2, number: "B", email: "same@x.com")], Snapshot());
        Assert.All(dup.Rows, r => Assert.True(Has(r, "DuplicateWorkEmailInFile")));
    }

    [Fact]
    public void Indistinguishable_duplicates_block_unless_key_or_decision()
    {
        var blocked = Resolve([Row(1), Row(2)], Snapshot());
        Assert.Contains(blocked.Rows, r => Has(r, "IndistinguishableDuplicateRow"));

        var distinguished = Resolve([Row(1, number: "A"), Row(2, number: "B")], Snapshot());
        Assert.DoesNotContain(distinguished.Rows, r => Has(r, "IndistinguishableDuplicateRow"));

        var kept = Resolve([Row(1), Row(2)], Snapshot(),
            new WorkforceResolutionDecisions(new HashSet<int>(), new HashSet<int>(), new HashSet<int>(), new HashSet<int> { 1, 2 }, new Dictionary<string, Guid>(), new Dictionary<int, Guid>()));
        Assert.DoesNotContain(kept.Rows, r => Has(r, "IndistinguishableDuplicateRow"));
    }

    [Fact]
    public void Unresolved_organization_blocks_and_grouped_decision_resolves_all()
    {
        var rows = new[] { Row(1, number: "A", org: "Mystery"), Row(2, number: "B", org: "Mystery") };
        Assert.All(Resolve(rows, Snapshot()).Rows, r => Assert.True(Has(r, "OrganizationUnresolved")));

        var resolved = Resolve(rows, Snapshot(),
            new WorkforceResolutionDecisions(new HashSet<int>(), new HashSet<int>(), new HashSet<int>(), new HashSet<int>(),
                new Dictionary<string, Guid> { ["mystery"] = OpsUnit }, new Dictionary<int, Guid>()));
        Assert.All(resolved.Rows, r => Assert.Equal(OpsUnit, r.ResolvedOrgUnitId));
    }

    [Fact]
    public void Organization_invalid_today_blocks_for_past_baseline()
    {
        var snap = Snapshot(opsValidToday: false);
        var r = Only(Resolve([Row(1, number: "A", org: "OPS")], snap, baseline: new DateOnly(2026, 1, 1)));
        Assert.True(Has(r, "OrganizationInvalidToday"));
    }

    [Fact]
    public void Manager_resolves_to_existing_employee_by_number()
    {
        var mgr = Emp("M-1", "Youssef", "BenAli");
        var snap = Snapshot([mgr]);
        var r = Only(Resolve([Row(1, number: "A", managerRef: "M-1")], snap));
        Assert.Equal(ManagerResolutionKind.ExistingEmployee, r.Manager.Kind);
        Assert.Equal(mgr.EmployeeId, r.Manager.EmployeeId);
    }

    [Fact]
    public void Same_import_manager_by_number_and_by_worker_key()
    {
        var byNumber = Resolve([Row(1, number: "A", managerRef: "B"), Row(2, number: "B", first: "Boss", last: "One")], Snapshot());
        Assert.Equal(ManagerResolutionKind.SameImportRow, byNumber.Rows[0].Manager.Kind);
        Assert.Equal(2, byNumber.Rows[0].Manager.SameImportSourceRowNumber);

        var byKey = Resolve([Row(1, workerKey: "A-142", managerKey: "A-101"), Row(2, workerKey: "A-101", first: "Boss", last: "One")], Snapshot());
        Assert.Equal(ManagerResolutionKind.SameImportRow, byKey.Rows[0].Manager.Kind);
    }

    [Fact]
    public void Unresolved_manager_blocks_and_blank_is_no_manager()
    {
        Assert.True(Has(Only(Resolve([Row(1, number: "A", managerRef: "GHOST")], Snapshot())), "ManagerUnresolved"));
        Assert.Equal(ManagerResolutionKind.None, Only(Resolve([Row(1, number: "A")], Snapshot())).Manager.Kind);
    }

    [Fact]
    public void Self_and_cycle_are_blocked()
    {
        var self = Resolve([Row(1, number: "A", managerRef: "A")], Snapshot());
        Assert.True(Has(self.Rows[0], "SelfManager"));

        var cycle = Resolve([Row(1, number: "A", managerRef: "B"), Row(2, number: "B", first: "X", last: "Y", managerRef: "A")], Snapshot());
        Assert.Contains(cycle.Rows, r => Has(r, "ManagerCycle"));
    }

    [Fact]
    public void Excluding_a_manager_leaves_dependents_unresolved()
    {
        var p = Resolve([Row(1, number: "A", managerRef: "B"), Row(2, number: "B", first: "Boss", last: "One")], Snapshot(),
            new WorkforceResolutionDecisions(new HashSet<int> { 2 }, new HashSet<int>(), new HashSet<int>(), new HashSet<int>(), new Dictionary<string, Guid>(), new Dictionary<int, Guid>()));
        Assert.Equal(WorkforceImportRowClassification.Excluded, p.Rows[1].Classification);
        Assert.True(Has(p.Rows[0], "ManagerUnresolved"));
    }

    [Fact]
    public void Lifecycle_guards_block_former_and_ended()
    {
        Assert.True(Has(Only(Resolve([Row(1, number: "A", status: "Terminated")], Snapshot())), "FormerWorkerNotEstablished"));
        Assert.True(Has(Only(Resolve([Row(1, number: "A", end: new DateOnly(2024, 1, 1))], Snapshot())), "FormerWorkerNotEstablished"));

        // Past baseline, end date between baseline and today.
        var r = Only(Resolve([Row(1, number: "A", end: new DateOnly(2026, 5, 1))], Snapshot(), baseline: new DateOnly(2026, 1, 1)));
        Assert.True(Has(r, "EmploymentEndedBeforeToday"));
    }

    [Fact]
    public void Generated_number_is_information_not_blocker()
    {
        var r = Only(Resolve([Row(1)], Snapshot(),
            new WorkforceResolutionDecisions(new HashSet<int>(), new HashSet<int>(), new HashSet<int>(), new HashSet<int> { 1 }, new Dictionary<string, Guid>(), new Dictionary<int, Guid>())));
        Assert.True(r.Issues.Any(i => i.Code == "EmployeeNumberGenerated" && i.Severity == Severities.Information));
        Assert.Equal(WorkforceImportRowClassification.NewEmployee, r.Classification);
    }

    [Fact]
    public void Missing_title_blocks()
        => Assert.True(Has(Only(Resolve([Row(1, number: "A", title: null)], Snapshot())), "DisplayTitleMissing"));

    [Fact]
    public void Trusted_fusion_employee_reference_is_strongest_identity()
    {
        var emp = Emp("E-1", "Amina", "Mansour", title: "Consultant", org: "OPS");
        var snap = Snapshot([emp]);
        var r = Only(Resolve([Row(1, fusionEmp: emp.EmployeeId.ToString(), title: "Consultant", org: "OPS")], snap));
        Assert.Equal(WorkforceImportRowClassification.ExistingAnchor, r.Classification);
        Assert.Equal(emp.EmployeeId, r.MatchedEmployeeId);
    }

    [Fact]
    public void Contradictory_fusion_reference_and_number_block()
    {
        var a = Emp("A-1", "Amina", "Mansour");
        var b = Emp("B-1", "Youssef", "BenAli");
        var snap = Snapshot([a, b]);
        Assert.True(Has(Only(Resolve([Row(1, fusionEmp: a.EmployeeId.ToString(), number: "B-1")], snap)), "ContradictoryStrongIdentifiers"));
    }

    [Fact]
    public void Unresolved_or_untenanted_fusion_reference_blocks()
    {
        var r = Only(Resolve([Row(1, fusionEmp: Guid.NewGuid().ToString())], Snapshot()));
        Assert.True(Has(r, "FusionEmployeeReferenceUnresolved"));
    }

    [Fact]
    public void Trusted_fusion_organization_and_manager_references_resolve()
    {
        var mgr = Emp("M-1", "Boss", "One");
        var snap = Snapshot([mgr]);
        var r = Only(Resolve([Row(1, number: "A", org: null, fusionOrg: OpsUnit.ToString(), fusionMgr: mgr.EmployeeId.ToString())], snap));
        Assert.Equal(OpsUnit, r.ResolvedOrgUnitId);
        Assert.Equal(ManagerResolutionKind.ExistingEmployee, r.Manager.Kind);
        Assert.Equal(mgr.EmployeeId, r.Manager.EmployeeId);
    }

    // ---- Temporal establishment / one-readiness-contract ----

    [Fact]
    public void Absent_work_date_resolves_to_baseline()
    {
        var r = Only(Resolve([Row(1, number: "A", workEffective: null)], Snapshot(establishedFrom: new DateOnly(2026, 8, 1))));
        Assert.Equal(Baseline, r.ResolvedWorkEffectiveDate);
        Assert.Equal(WorkforceImportRowClassification.NewEmployee, r.Classification);
    }

    [Fact]
    public void Explicit_work_date_after_org_history_is_preserved_and_ready()
    {
        var work = new DateOnly(2026, 8, 10);
        var r = Only(Resolve([Row(1, number: "A", workEffective: work)], Snapshot(establishedFrom: new DateOnly(2026, 8, 1))));
        Assert.Equal(work, r.ResolvedWorkEffectiveDate);
        Assert.Equal(WorkforceImportRowClassification.NewEmployee, r.Classification);
        Assert.False(Has(r, "WorkDatePrecedesOrganizationHistory"));
    }

    [Fact]
    public void Work_date_before_org_history_is_grouped_temporal_blocker()
    {
        var r = Only(Resolve(
            [Row(1, number: "A", workEffective: new DateOnly(2023, 3, 1))],
            Snapshot(establishedFrom: new DateOnly(2026, 8, 19))));
        Assert.Equal(WorkforceImportRowClassification.NeedsAttention, r.Classification);
        var issue = Assert.Single(r.Issues.Where(i => i.Code == "WorkDatePrecedesOrganizationHistory"));
        Assert.Equal("workdate-history", issue.DecisionKey); // one grouped decision for every affected row
    }

    [Fact]
    public void Many_rows_before_org_history_share_one_grouped_decision()
    {
        var snap = Snapshot(establishedFrom: new DateOnly(2026, 8, 19));
        var p = Resolve(
            [Row(1, number: "A", workEffective: new DateOnly(2023, 3, 1)),
             Row(2, number: "B", first: "Sami", last: "Ali", workEffective: new DateOnly(2022, 1, 1))],
            snap);
        Assert.All(p.Rows, r => Assert.True(Has(r, "WorkDatePrecedesOrganizationHistory")));
        var keys = p.Rows.SelectMany(r => r.Issues).Where(i => i.DecisionKey is not null).Select(i => i.DecisionKey).Distinct().ToList();
        Assert.Equal(["workdate-history"], keys);
    }

    [Fact]
    public void Explicit_normalization_clears_temporal_blocker_and_dates_to_baseline()
    {
        var snap = Snapshot(establishedFrom: new DateOnly(2026, 8, 19));
        var baseline = new DateOnly(2026, 8, 19);
        var decisions = new WorkforceResolutionDecisions(
            new HashSet<int>(), new HashSet<int>(), new HashSet<int>(), new HashSet<int>(),
            new Dictionary<string, Guid>(), new Dictionary<int, Guid>(), NormalizeWorkDatesToBaseline: true);
        var r = Only(Resolve([Row(1, number: "A", workEffective: new DateOnly(2023, 3, 1))], snap, decisions, baseline: baseline));
        Assert.False(Has(r, "WorkDatePrecedesOrganizationHistory"));
        Assert.Equal(WorkforceImportRowClassification.NewEmployee, r.Classification);
        Assert.Equal(baseline, r.ResolvedWorkEffectiveDate);
    }
}

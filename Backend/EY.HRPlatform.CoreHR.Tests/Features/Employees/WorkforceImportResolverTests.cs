using EY.HRPlatform.CoreHR.Features.Employees.Import;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public sealed class WorkforceImportResolverTests
{
    private readonly WorkforceImportResolver _resolver = new();
    private static readonly DateOnly Baseline = new(2026, 8, 17);
    private static readonly DateOnly Today = new(2026, 8, 17);
    private static readonly Guid OpsUnit = Guid.NewGuid();
    private static readonly Guid FinanceUnit = Guid.NewGuid();
    private static readonly Guid SalesEmeaUnit = Guid.NewGuid();
    private static readonly Guid SalesUsUnit = Guid.NewGuid();

    private static NormalizedWorkforceRow Row(
        int n, string? number = null, string? first = "Amina", string? last = "Mansour", string? org = "OPS",
        string? title = "Consultant", string? email = null, string? managerRef = null, string? workerKey = null,
        string? managerKey = null, WorkforceLifecycle? lifecycle = null, DateOnly? end = null, DateOnly? start = null,
        string? fusionEmp = null, string? fusionOrg = null, string? fusionMgr = null, DateOnly? workEffective = null,
        IReadOnlyList<WorkforceInterpretationIssue>? issues = null)
        => new(n, fusionEmp, fusionOrg, fusionMgr, number, first, last, null, email, start ?? new DateOnly(2021, 2, 1),
            workEffective ?? start ?? new DateOnly(2021, 2, 1), org, title, null,
            managerRef, workerKey, managerKey, lifecycle, end, issues ?? []);

    private static CanonicalEmployeeRef Emp(
        string number, string first, string last, bool former = false, string? email = null, string? title = null,
        Guid? unit = null, Guid? manager = null)
        => new(Guid.NewGuid(), number, email, first, last, former, unit, title, null, manager);

    private static WorkforceCanonicalSnapshot Snapshot(IEnumerable<CanonicalEmployeeRef>? employees = null, bool opsValidToday = true)
    {
        var list = (employees ?? []).ToList();
        var units = new[]
        {
            new CanonicalOrgUnitRef(OpsUnit, "OPS", "lumera/operations", "Operations", opsValidToday, DateOnly.MinValue),
            new CanonicalOrgUnitRef(FinanceUnit, "FIN", "lumera/finance", "Finance", true, DateOnly.MinValue),
            new CanonicalOrgUnitRef(SalesEmeaUnit, "SAL-EMEA", "lumera/emea/sales", "Sales", true, DateOnly.MinValue),
            new CanonicalOrgUnitRef(SalesUsUnit, "SAL-US", "lumera/us/sales", "Sales", true, DateOnly.MinValue),
        };
        return new WorkforceCanonicalSnapshot
        {
            ByEmployeeNumber = list.Where(e => e.EmployeeNumber is not null).ToDictionary(e => WorkforceCanonicalSnapshot.NormalizeNumber(e.EmployeeNumber!)),
            ByWorkEmail = list.Where(e => e.WorkEmail is not null).ToDictionary(e => WorkforceCanonicalSnapshot.NormalizeEmail(e.WorkEmail!)),
            ByFusionId = list.ToDictionary(e => e.EmployeeId),
            OrgById = units.ToDictionary(u => u.OrgUnitId),
            OrgByCode = units.ToDictionary(u => u.Code.ToLowerInvariant()),
            OrgByPath = units.ToDictionary(u => u.Path.ToLowerInvariant()),
            OrgByName = units.ToLookup(u => u.Name.ToLowerInvariant()),
        };
    }

    private static WorkforceResolutionDecisions Decide(
        Dictionary<string, Guid>? org = null,
        Dictionary<string, Guid>? managerEmployee = null,
        Dictionary<string, int>? managerRow = null,
        HashSet<string>? noManager = null,
        HashSet<int>? keepDistinct = null,
        bool useBaseline = false)
        => new(keepDistinct ?? [], org ?? [], managerEmployee ?? [], managerRow ?? [], noManager ?? [], useBaseline);

    private WorkforceImportProposal Resolve(IEnumerable<NormalizedWorkforceRow> rows, WorkforceCanonicalSnapshot snapshot, WorkforceResolutionDecisions? decisions = null, DateOnly? baseline = null)
        => _resolver.Resolve(rows.ToList(), snapshot, decisions ?? WorkforceResolutionDecisions.None, baseline ?? Baseline, Today);

    private static ResolvedWorkforceRow Only(WorkforceImportProposal p) => Assert.Single(p.Rows);
    private static bool Has(ResolvedWorkforceRow r, string code) => r.Issues.Any(i => i.Code == code);

    // ---- Classification ----

    [Fact]
    public void Unknown_number_is_created()
    {
        var r = Only(Resolve([Row(1, number: "NEW-1")], Snapshot()));
        Assert.Equal(WorkforceImportRowClassification.Create, r.Classification);
        Assert.Equal(OpsUnit, r.ResolvedOrgUnitId);
        Assert.Empty(r.Issues);
    }

    [Fact]
    public void Existing_number_is_a_read_only_anchor()
    {
        var snap = Snapshot([Emp("E-1", "Amina", "Mansour", title: "Consultant", unit: OpsUnit)]);
        var r = Only(Resolve([Row(1, number: "E-1", title: "Consultant", org: "OPS")], snap));
        Assert.Equal(WorkforceImportRowClassification.Existing, r.Classification);
        Assert.NotNull(r.MatchedEmployeeId);
        Assert.Empty(r.Issues);
    }

    [Fact]
    public void Existing_anchor_difference_is_a_warning_and_never_blocks_or_excludes()
    {
        var boss = Emp("M-9", "Old", "Boss");
        var snap = Snapshot([boss, Emp("E-1", "Amina", "Mansour", title: "Consultant", unit: OpsUnit, manager: boss.EmployeeId)]);
        var r = Only(Resolve([Row(1, number: "E-1", title: "Director", org: "FIN")], snap));
        Assert.Equal(WorkforceImportRowClassification.Existing, r.Classification);
        var warning = Assert.Single(r.Issues);
        Assert.Equal(WorkforceIssueCodes.ExistingDifference, warning.Code);
        Assert.Equal(ImportIssueSeverity.Warning, warning.Severity);
        Assert.Contains("title", warning.Message);
        Assert.Contains("organization", warning.Message);
    }

    [Fact]
    public void Existing_anchor_can_be_a_manager_target_for_new_people()
    {
        var mgr = Emp("M-1", "Youssef", "BenAli");
        var r = Resolve([Row(1, number: "M-1", first: "Youssef", last: "BenAli"), Row(2, number: "N-1", first: "Sami", last: "Ali", managerRef: "M-1")], Snapshot([mgr]));
        Assert.Equal(WorkforceImportRowClassification.Existing, r.Rows[0].Classification);
        Assert.Equal(ManagerResolutionKind.ExistingEmployee, r.Rows[1].Manager.Kind);
        Assert.Equal(mgr.EmployeeId, r.Rows[1].Manager.EmployeeId);
    }

    [Fact]
    public void Former_employee_number_is_a_lifecycle_conflict_not_an_anchor()
    {
        var snap = Snapshot([Emp("F-1", "Amina", "Mansour", former: true)]);
        var r = Only(Resolve([Row(1, number: "F-1")], snap));
        Assert.Equal(WorkforceImportRowClassification.Blocked, r.Classification);
        Assert.True(Has(r, WorkforceIssueCodes.FormerEmployeeLifecycleConflict));
    }

    [Theory]
    [InlineData(WorkforceLifecycle.Former, null, null, WorkforceIssueCodes.NotImportedFormerWorker)]
    [InlineData(null, "2024-01-01", null, WorkforceIssueCodes.NotImportedFormerWorker)]
    [InlineData(null, null, "2030-01-01", WorkforceIssueCodes.NotImportedFutureStart)]
    public void People_outside_establishment_scope_are_deterministically_not_imported(
        WorkforceLifecycle? lifecycle, string? end, string? start, string code)
    {
        var r = Only(Resolve([Row(1, number: "A", lifecycle: lifecycle, end: end is null ? null : DateOnly.Parse(end),
            start: start is null ? null : DateOnly.Parse(start), title: null)], Snapshot()));
        Assert.Equal(WorkforceImportRowClassification.NotImported, r.Classification);
        var only = Assert.Single(r.Issues); // their other data problems don't matter: they aren't imported
        Assert.Equal(code, only.Code);
        Assert.Equal(ImportIssueSeverity.Warning, only.Severity);
    }

    [Fact]
    public void Ended_between_a_past_baseline_and_today_is_not_imported()
    {
        var r = Only(Resolve([Row(1, number: "A", end: new DateOnly(2026, 5, 1))], Snapshot(), baseline: new DateOnly(2026, 1, 1)));
        Assert.Equal(WorkforceImportRowClassification.NotImported, r.Classification);
        Assert.True(Has(r, WorkforceIssueCodes.NotImportedEndedBeforeToday));
    }

    // ---- Identity ----

    [Fact]
    public void Duplicate_number_in_file_blocks()
    {
        var p = Resolve([Row(1, number: "DUP"), Row(2, number: "DUP", first: "Sami", last: "Ali")], Snapshot());
        Assert.All(p.Rows, r => Assert.True(Has(r, WorkforceIssueCodes.DuplicateEmployeeNumberInFile)));
        Assert.Equal(2, p.BlockedCount);
    }

    [Fact]
    public void Strong_key_name_mismatch_blocks()
    {
        var snap = Snapshot([Emp("E-1", "Youssef", "BenAli")]);
        Assert.True(Has(Only(Resolve([Row(1, number: "E-1", first: "Amina", last: "Mansour")], snap)), WorkforceIssueCodes.StrongKeyNameMismatch));
    }

    [Fact]
    public void Occupied_and_duplicate_work_email_block()
    {
        var snap = Snapshot([Emp("E-1", "Someone", "Else", email: "taken@x.com")]);
        Assert.True(Has(Only(Resolve([Row(1, number: "NEW", email: "taken@x.com")], snap)), WorkforceIssueCodes.WorkEmailOccupied));

        var dup = Resolve([Row(1, number: "A", email: "same@x.com"), Row(2, number: "B", email: "same@x.com")], Snapshot());
        Assert.All(dup.Rows, r => Assert.True(Has(r, WorkforceIssueCodes.DuplicateWorkEmailInFile)));
    }

    [Fact]
    public void Missing_number_is_generated_on_an_empty_tenant_but_blocks_when_people_exist()
    {
        var empty = Only(Resolve([Row(1)], Snapshot()));
        Assert.Equal(WorkforceImportRowClassification.Create, empty.Classification);
        Assert.Contains(empty.Issues, i => i.Code == WorkforceIssueCodes.EmployeeNumberGenerated && i.Severity == ImportIssueSeverity.Warning);

        var populated = Only(Resolve([Row(1)], Snapshot([Emp("X-1", "Someone", "Else")])));
        Assert.Equal(WorkforceImportRowClassification.Blocked, populated.Classification);
        Assert.True(Has(populated, WorkforceIssueCodes.EmployeeIdentifierMissing));
    }

    [Fact]
    public void Name_similarity_is_a_quiet_warning_and_never_identity()
    {
        var snap = Snapshot([Emp("E-1", "Amina", "Mansour")]);
        var r = Only(Resolve([Row(1, number: "E-2")], snap));
        Assert.Equal(WorkforceImportRowClassification.Create, r.Classification);
        Assert.Null(r.MatchedEmployeeId);
        Assert.Contains(r.Issues, i => i.Code == WorkforceIssueCodes.SimilarNameExists && !i.IsBlocker);
    }

    [Fact]
    public void Indistinguishable_duplicates_block_unless_kept_distinct()
    {
        var blocked = Resolve([Row(1), Row(2)], Snapshot());
        Assert.Contains(blocked.Rows, r => Has(r, WorkforceIssueCodes.IndistinguishableDuplicateRow));

        var kept = Resolve([Row(1), Row(2)], Snapshot(), Decide(keepDistinct: [2]));
        Assert.DoesNotContain(kept.Rows, r => Has(r, WorkforceIssueCodes.IndistinguishableDuplicateRow));
    }

    [Fact]
    public void Trusted_fusion_references_are_strongest_and_contradictions_block()
    {
        var emp = Emp("E-1", "Amina", "Mansour", title: "Consultant", unit: OpsUnit);
        var other = Emp("B-1", "Youssef", "BenAli");
        var snap = Snapshot([emp, other]);
        Assert.Equal(WorkforceImportRowClassification.Existing,
            Only(Resolve([Row(1, fusionEmp: emp.EmployeeId.ToString(), title: "Consultant")], snap)).Classification);
        Assert.True(Has(Only(Resolve([Row(1, fusionEmp: emp.EmployeeId.ToString(), number: "B-1")], snap)), WorkforceIssueCodes.ContradictoryStrongIdentifiers));
        Assert.True(Has(Only(Resolve([Row(1, fusionEmp: Guid.NewGuid().ToString())], snap)), WorkforceIssueCodes.FusionEmployeeReferenceUnresolved));
    }

    // ---- Organization ----

    [Fact]
    public void Organization_resolves_by_code_path_or_unique_name()
    {
        var p = Resolve([
            Row(1, number: "A", org: "fin"),
            Row(2, number: "B", first: "B", org: "lumera/finance"),
            Row(3, number: "C", first: "C", org: "Finance"),
        ], Snapshot());
        Assert.All(p.Rows, r => Assert.Equal(FinanceUnit, r.ResolvedOrgUnitId));
    }

    [Fact]
    public void Ambiguous_name_blocks_and_one_resolution_answers_every_row()
    {
        var rows = new[] { Row(1, number: "A", org: "Sales"), Row(2, number: "B", first: "B", org: "Sales") };
        var before = Resolve(rows, Snapshot());
        Assert.All(before.Rows, r =>
        {
            var issue = Assert.Single(r.Issues, i => i.Code == WorkforceIssueCodes.OrganizationUnresolved);
            Assert.Equal("org:sales", issue.DecisionKey);
        });

        var after = Resolve(rows, Snapshot(), Decide(org: new() { ["sales"] = SalesEmeaUnit }));
        Assert.All(after.Rows, r => Assert.Equal(SalesEmeaUnit, r.ResolvedOrgUnitId));
    }

    [Fact]
    public void A_resolution_never_overrides_a_value_that_already_resolved()
    {
        var r = Only(Resolve([Row(1, number: "A", org: "FIN")], Snapshot(), Decide(org: new() { ["fin"] = OpsUnit })));
        Assert.Equal(FinanceUnit, r.ResolvedOrgUnitId);
    }

    [Fact]
    public void Chosen_unit_that_is_not_available_blocks()
    {
        var r = Only(Resolve([Row(1, number: "A", org: "Mystery")], Snapshot(), Decide(org: new() { ["mystery"] = Guid.NewGuid() })));
        Assert.True(Has(r, WorkforceIssueCodes.OrganizationDecisionInvalid));
    }

    [Fact]
    public void Organization_invalid_today_blocks_for_past_baseline_and_can_be_redirected()
    {
        var snap = Snapshot(opsValidToday: false);
        var past = new DateOnly(2026, 1, 1);
        Assert.True(Has(Only(Resolve([Row(1, number: "A", org: "OPS")], snap, baseline: past)), WorkforceIssueCodes.OrganizationInvalidToday));
        var redirected = Only(Resolve([Row(1, number: "A", org: "OPS")], snap, Decide(org: new() { ["ops"] = FinanceUnit }), baseline: past));
        Assert.Equal(FinanceUnit, redirected.ResolvedOrgUnitId);
    }

    // ---- Manager ----

    [Fact]
    public void Manager_resolves_to_existing_employee_by_number()
    {
        var mgr = Emp("M-1", "Youssef", "BenAli");
        var r = Only(Resolve([Row(1, number: "A", managerRef: "M-1")], Snapshot([mgr])));
        Assert.Equal(ManagerResolutionKind.ExistingEmployee, r.Manager.Kind);
        Assert.Equal(mgr.EmployeeId, r.Manager.EmployeeId);
    }

    [Fact]
    public void Manager_later_in_the_same_file_resolves_regardless_of_row_order()
    {
        var p = Resolve([
            Row(1, number: "A", managerRef: "C"),
            Row(2, number: "B", first: "Bob", managerRef: "C"),
            Row(3, number: "C", first: "Boss", last: "One"),
        ], Snapshot());
        Assert.All(p.Rows.Take(2), r => Assert.Equal(3, r.Manager.SameImportSourceRowNumber));
        Assert.Equal(3, p.CreateCount);
    }

    [Fact]
    public void Same_import_manager_by_worker_key_and_by_email()
    {
        var byKey = Resolve([Row(1, workerKey: "A-142", managerKey: "A-101"), Row(2, workerKey: "A-101", first: "Boss", last: "One")], Snapshot());
        Assert.Equal(ManagerResolutionKind.SameImportRow, byKey.Rows[0].Manager.Kind);

        var byEmail = Resolve([Row(1, number: "A", managerRef: "boss@x.com"), Row(2, number: "B", first: "Boss", last: "One", email: "boss@x.com")], Snapshot());
        Assert.Equal(2, byEmail.Rows[0].Manager.SameImportSourceRowNumber);
    }

    [Fact]
    public void Manager_name_is_never_an_automatic_identity_even_when_unique()
    {
        var mgr = Emp("M-1", "Youssef", "BenAli");
        var r = Only(Resolve([Row(1, number: "A", managerRef: "Youssef BenAli")], Snapshot([mgr])));
        Assert.Equal(ManagerResolutionKind.Unresolved, r.Manager.Kind);
        var issue = Assert.Single(r.Issues, i => i.Code == WorkforceIssueCodes.ManagerUnresolved);
        Assert.Equal("mgr:YOUSSEF BENALI", issue.DecisionKey);
        Assert.Contains(WorkforceResolutionKind.ChooseManager, issue.Resolutions);
    }

    [Fact]
    public void One_manager_resolution_answers_every_report_of_that_reference()
    {
        var rows = new[]
        {
            Row(1, number: "A", managerRef: "GHOST"),
            Row(2, number: "B", first: "Bob", last: "Two", managerRef: "GHOST"),
            Row(3, number: "C", first: "Boss", last: "One"),
        };
        var after = Resolve(rows, Snapshot(), Decide(managerRow: new() { ["GHOST"] = 3 }));
        Assert.Equal(3, after.Rows[0].Manager.SameImportSourceRowNumber);
        Assert.Equal(3, after.Rows[1].Manager.SameImportSourceRowNumber);
        Assert.Equal(0, after.BlockedCount);

        var none = Resolve(rows, Snapshot(), Decide(noManager: ["GHOST"]));
        Assert.Equal(ManagerResolutionKind.None, none.Rows[0].Manager.Kind);
    }

    [Fact]
    public void Blank_manager_is_a_valid_fact()
        => Assert.Equal(ManagerResolutionKind.None, Only(Resolve([Row(1, number: "A")], Snapshot())).Manager.Kind);

    [Fact]
    public void Self_manager_and_cycles_block()
    {
        Assert.True(Has(Resolve([Row(1, number: "A", managerRef: "A")], Snapshot()).Rows[0], WorkforceIssueCodes.SelfManager));
        var cycle = Resolve([Row(1, number: "A", managerRef: "B"), Row(2, number: "B", first: "X", last: "Y", managerRef: "A")], Snapshot());
        Assert.All(cycle.Rows, r => Assert.True(Has(r, WorkforceIssueCodes.ManagerCycle)));
    }

    [Fact]
    public void Manager_who_is_not_imported_blocks_reports_until_resolved()
    {
        var rows = new[]
        {
            Row(1, number: "A", managerRef: "B"),
            Row(2, number: "B", first: "Gone", last: "Boss", lifecycle: WorkforceLifecycle.Former),
            Row(3, number: "C", first: "New", last: "Boss"),
        };
        var before = Resolve(rows, Snapshot());
        Assert.Equal(WorkforceImportRowClassification.NotImported, before.Rows[1].Classification);
        Assert.True(Has(before.Rows[0], WorkforceIssueCodes.ManagerNotImported));

        var after = Resolve(rows, Snapshot(), Decide(managerRow: new() { ["B"] = 3 }));
        Assert.Equal(3, after.Rows[0].Manager.SameImportSourceRowNumber);
        Assert.Equal(WorkforceImportRowClassification.Create, after.Rows[0].Classification);
    }

    // ---- Dates ----

    [Fact]
    public void Absent_work_date_resolves_to_employment_start()
    {
        var r = Only(Resolve([Row(1, number: "A", start: new DateOnly(2022, 4, 1), workEffective: null)], Snapshot()));
        Assert.Equal(new DateOnly(2022, 4, 1), r.ResolvedWorkEffectiveDate);
    }

    [Fact]
    public void Using_the_baseline_answers_an_unusable_work_date()
    {
        var invalid = new WorkforceInterpretationIssue(WorkforceIssueCodes.WorkEffectiveDateInvalid, "out of range", WorkforceImportField.WorkEffectiveFrom);
        var blocked = Only(Resolve([Row(1, number: "A", issues: [invalid])], Snapshot()));
        Assert.Equal(WorkforceImportRowClassification.Blocked, blocked.Classification);

        var answered = Only(Resolve([Row(1, number: "A", issues: [invalid])], Snapshot(), Decide(useBaseline: true)));
        Assert.Equal(WorkforceImportRowClassification.Create, answered.Classification);
        Assert.Equal(Baseline, answered.ResolvedWorkEffectiveDate);
    }

    [Fact]
    public void Missing_title_blocks()
        => Assert.True(Has(Only(Resolve([Row(1, number: "A", title: null)], Snapshot())), WorkforceIssueCodes.DisplayTitleMissing));

    [Fact]
    public void Every_issue_code_has_a_catalog_entry_with_blocker_or_warning_severity()
    {
        foreach (var code in WorkforceImportIssueCatalog.Codes)
            Assert.Contains(WorkforceImportIssueCatalog.SeverityOf(code), new[] { ImportIssueSeverity.Blocker, ImportIssueSeverity.Warning });
    }
}

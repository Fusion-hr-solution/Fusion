using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public sealed class WorkforceImportInterpreterTests
{
    private readonly WorkforceImportInterpreter _interpreter = new();
    private static readonly DateOnly Baseline = new(2026, 8, 17);

    private WorkforceInterpretationResult Run(
        string[] headers,
        string?[][] rows,
        WorkforceImportInterpretation? decisions = null)
        => _interpreter.Interpret(
            headers,
            rows.Select(r => (IReadOnlyList<string?>)r).ToList(),
            decisions ?? WorkforceImportInterpretation.Empty,
            Baseline);

    [Fact]
    public void French_and_customer_aliases_auto_map()
    {
        var result = Run(
            ["Matricule", "Prénom", "Nom", "Date embauche", "Département", "Poste occupé", "Responsable"],
            [["001", "Amina", "Mansour", "2021-02-01", "Operations", "Consultant", "Youssef"]]);

        Assert.Contains(result.Mappings, m => m.Field == WorkforceImportField.EmployeeNumber && m.Origin == "deterministic");
        Assert.Contains(result.Mappings, m => m.Field == WorkforceImportField.Organization);
        Assert.Contains(result.Mappings, m => m.Field == WorkforceImportField.Manager);
        Assert.Empty(result.UnresolvedRequiredFields);
        Assert.False(result.NameFormatDecisionNeeded);
        Assert.False(result.DateFormatDecisionNeeded);
    }

    [Fact]
    public void Missing_required_fields_are_reported()
    {
        var result = Run(["Matricule", "Prénom", "Nom"], [["001", "Amina", "Mansour"]]);
        Assert.Contains(WorkforceImportField.EmploymentStart, result.UnresolvedRequiredFields);
        Assert.Contains(WorkforceImportField.Organization, result.UnresolvedRequiredFields);
        Assert.Contains(WorkforceImportField.DisplayTitle, result.UnresolvedRequiredFields);
    }

    [Fact]
    public void Combined_name_needs_decision_then_splits_last_comma_first()
    {
        var headers = new[] { "Employee Name", "Start Date", "Department", "Title" };
        var rows = new[] { new string?[] { "Ben Ali, Youssef", "2021-02-01", "Ops", "Lead" } };

        Assert.True(Run(headers, rows).NameFormatDecisionNeeded);

        var decided = Run(headers, rows, new WorkforceImportInterpretation(
            new Dictionary<int, WorkforceImportField>(), WorkforceNameFormat.LastCommaFirst, WorkforceDateFormat.Iso));
        Assert.False(decided.NameFormatDecisionNeeded);
        Assert.Equal("Youssef", decided.Rows[0].FirstName);
        Assert.Equal("Ben Ali", decided.Rows[0].LastName);
    }

    [Fact]
    public void Ambiguous_date_needs_decision_then_parses_day_month_year()
    {
        var headers = new[] { "First Name", "Last Name", "Start Date", "Department", "Title" };
        var rows = new[] { new string?[] { "Amina", "Mansour", "01/02/2021", "Ops", "Lead" } };

        Assert.True(Run(headers, rows).DateFormatDecisionNeeded);

        var decided = Run(headers, rows, new WorkforceImportInterpretation(
            new Dictionary<int, WorkforceImportField>(), null, WorkforceDateFormat.DayMonthYear));
        Assert.False(decided.DateFormatDecisionNeeded);
        Assert.Equal(new DateOnly(2021, 2, 1), decided.Rows[0].EmploymentStart);
    }

    [Fact]
    public void Iso_date_is_unambiguous_and_needs_no_decision()
    {
        var result = Run(
            ["First Name", "Last Name", "Employment Start", "Organization", "Title"],
            [["Amina", "Mansour", "2021-02-01", "Ops", "Lead"]]);
        Assert.False(result.DateFormatDecisionNeeded);
        Assert.Equal(new DateOnly(2021, 2, 1), result.Rows[0].EmploymentStart);
    }

    [Fact]
    public void Work_effective_absent_uses_baseline()
    {
        var row = Run(
            ["First Name", "Last Name", "Employment Start", "Organization", "Title"],
            [["Amina", "Mansour", "2021-02-01", "Ops", "Lead"]]).Rows[0];
        Assert.Equal(Baseline, row.WorkEffectiveFrom);
        Assert.DoesNotContain(row.Issues, i => i.Field == WorkforceImportField.WorkEffectiveFrom);
    }

    [Fact]
    public void Work_effective_supplied_valid_is_used()
    {
        var row = Run(
            ["First Name", "Last Name", "Employment Start", "Work Details Effective From", "Organization", "Title"],
            [["Amina", "Mansour", "2021-02-01", "2025-01-01", "Ops", "Lead"]]).Rows[0];
        Assert.Equal(new DateOnly(2025, 1, 1), row.WorkEffectiveFrom);
    }

    [Fact]
    public void Work_effective_supplied_after_baseline_blocks_and_never_falls_back()
    {
        var row = Run(
            ["First Name", "Last Name", "Employment Start", "Work Details Effective From", "Organization", "Title"],
            [["Amina", "Mansour", "2021-02-01", "2030-01-01", "Ops", "Lead"]]).Rows[0];
        Assert.Null(row.WorkEffectiveFrom); // NEVER baseline fallback
        Assert.Contains(row.Issues, i => i.Code == "WorkEffectiveDateInvalid" && i.Severity == "blocker");
    }

    [Fact]
    public void Work_effective_supplied_before_employment_start_blocks()
    {
        var row = Run(
            ["First Name", "Last Name", "Employment Start", "Work Details Effective From", "Organization", "Title"],
            [["Amina", "Mansour", "2021-02-01", "2019-01-01", "Ops", "Lead"]]).Rows[0];
        Assert.Null(row.WorkEffectiveFrom);
        Assert.Contains(row.Issues, i => i.Code == "WorkEffectiveDateInvalid");
    }

    [Fact]
    public void Employment_start_after_baseline_blocks()
    {
        var row = Run(
            ["First Name", "Last Name", "Employment Start", "Organization", "Title"],
            [["Amina", "Mansour", "2030-01-01", "Ops", "Lead"]]).Rows[0];
        Assert.Contains(row.Issues, i => i.Code == "EmploymentStartAfterBaseline" && i.Severity == "blocker");
    }

    [Fact]
    public void Missing_employment_start_blocks()
    {
        var row = Run(
            ["First Name", "Last Name", "Employment Start", "Organization", "Title"],
            [["Amina", "Mansour", "", "Ops", "Lead"]]).Rows[0];
        Assert.Contains(row.Issues, i => i.Code == "EmploymentStartMissing");
    }

    [Fact]
    public void Source_local_worker_and_manager_references_captured()
    {
        var row = Run(
            ["Worker ID", "Manager ID", "First Name", "Last Name", "Employment Start", "Organization", "Title"],
            [["A-142", "A-101", "Amina", "Mansour", "2021-02-01", "Ops", "Lead"]]).Rows[0];
        Assert.Equal("A-142", row.WorkerKey);
        Assert.Equal("A-101", row.ManagerKey);
    }

    [Fact]
    public void Unique_identifier_cross_referenced_by_another_column_is_the_employee_number()
    {
        // Header-agnostic structural evidence: "Worker Ref" holds unique AST-#### identifiers, no
        // Employee Number is otherwise present, and "Reports To Ref" points into that same value set.
        // → Worker Ref IS the Employee Number; Reports To Ref IS the manager reference. No header
        // synonym, no hardcoding — the schema itself carries the meaning.
        var result = Run(
            ["Worker Ref", "First Name", "Family Name", "Employment Start", "Business Unit Ref", "Role Title", "Reports To Ref"],
            [
                ["AST-2001", "Amina", "Mansour", "2015-01-05", "AST", "Chief Executive Officer", ""],
                ["AST-2002", "Nour", "Feki", "2018-03-01", "AST", "Chief of Staff", "AST-2001"],
                ["AST-2003", "Sami", "Ali", "2019-01-01", "EXE", "CTO", "AST-2001"],
                ["", "Lina", "Ben", "2020-01-01", "EXE", "Engineer", "AST-2003"], // blank identifier → generated later
            ]);

        Assert.Contains(result.Mappings, m => m.Label == "Worker Ref" && m.Field == WorkforceImportField.EmployeeNumber && m.Origin == "structural");
        Assert.DoesNotContain(result.Mappings, m => m.Label == "Worker Ref" && m.Field == WorkforceImportField.WorkerReference);
        Assert.Contains(result.Mappings, m => m.Label == "Reports To Ref" && m.Field == WorkforceImportField.Manager && m.Origin == "structural");
        // A repeated, non-unique code column (Business Unit Ref) is NOT mistaken for identity.
        Assert.DoesNotContain(result.Mappings, m => m.Label == "Business Unit Ref" && m.Field == WorkforceImportField.EmployeeNumber);
        // Source Employee Numbers preserved; blank stays absent for downstream generation.
        Assert.Equal("AST-2001", result.Rows[0].EmployeeNumber);
        Assert.Equal("AST-2003", result.Rows[2].EmployeeNumber);
        Assert.True(string.IsNullOrEmpty(result.Rows[3].EmployeeNumber));
        Assert.Equal("AST-2001", result.Rows[1].ManagerReference);
    }

    [Fact]
    public void Source_local_key_beside_an_explicit_employee_number_stays_a_worker_reference()
    {
        // With an explicit Employee Number column present, identity inference does not run; a genuine
        // source-local key ("Worker ID" of opaque values) remains a WorkerReference.
        var result = Run(
            ["Employee Number", "Worker ID", "First Name", "Last Name", "Employment Start", "Organization", "Title", "Manager ID"],
            [
                ["E-1", "7f3a", "Amina", "Mansour", "2021-02-01", "Ops", "Lead", ""],
                ["E-2", "9b2c", "Sami", "Ali", "2020-01-01", "Ops", "Eng", "7f3a"],
            ]);
        Assert.Contains(result.Mappings, m => m.Label == "Employee Number" && m.Field == WorkforceImportField.EmployeeNumber);
        Assert.Contains(result.Mappings, m => m.Label == "Worker ID" && m.Field == WorkforceImportField.WorkerReference);
        Assert.Equal("E-1", result.Rows[0].EmployeeNumber);
        Assert.Equal("7f3a", result.Rows[0].WorkerKey);
    }

    [Fact]
    public void An_unmatched_unique_identifier_is_left_for_semantic_assistance_not_guessed()
    {
        // Two unique identifier columns, but neither references the other and no Employee Number is
        // present → the evidence is genuinely ambiguous → the interpreter makes NO deterministic
        // guess; the columns stay unresolved for semantic assistance / a grouped question.
        var result = Run(
            ["Ref A", "Ref B", "First Name", "Last Name", "Employment Start", "Organization", "Title"],
            [
                ["A-1", "Z-9", "Amina", "Mansour", "2021-02-01", "Ops", "Lead"],
                ["A-2", "Z-8", "Sami", "Ali", "2020-01-01", "Ops", "Eng"],
            ]);
        Assert.Contains(result.Mappings, m => m.Label == "Ref A" && m.Field == WorkforceImportField.Ignored && m.Origin == "unresolved");
        Assert.Contains(result.Mappings, m => m.Label == "Ref B" && m.Field == WorkforceImportField.Ignored && m.Origin == "unresolved");
        Assert.DoesNotContain(result.Mappings, m => m.Field == WorkforceImportField.EmployeeNumber);
    }

    [Fact]
    public void Lifecycle_status_and_end_date_are_captured_as_evidence()
    {
        var row = Run(
            ["First Name", "Last Name", "Employment Start", "Organization", "Title", "Status", "Termination Date"],
            [["Amina", "Mansour", "2021-02-01", "Ops", "Lead", "Terminated", "2024-06-30"]]).Rows[0];
        Assert.Equal("Terminated", row.LifecycleStatus);
        Assert.Equal(new DateOnly(2024, 6, 30), row.EmploymentEnd);
    }

    [Fact]
    public void Arbitrary_guid_column_is_not_trusted_but_explicit_fusion_header_is()
    {
        var guid = Guid.NewGuid().ToString();
        var result = Run(
            ["Record GUID", "Fusion Employee ID", "First Name", "Last Name", "Employment Start", "Organization", "Title"],
            [[guid, guid, "Amina", "Mansour", "2021-02-01", "Ops", "Lead"]]);

        // An arbitrary GUID-shaped column is NOT auto-mapped to a Fusion reference.
        Assert.DoesNotContain(result.Mappings, m => m.ColumnIndex == 0 && m.Field == WorkforceImportField.FusionEmployeeReference);
        // An explicitly recognized Fusion header is.
        Assert.Contains(result.Mappings, m => m.ColumnIndex == 1 && m.Field == WorkforceImportField.FusionEmployeeReference);
        Assert.Equal(guid, result.Rows[0].FusionEmployeeReference);
    }

    [Fact]
    public void Administrator_override_maps_a_column_globally()
    {
        var result = Run(
            ["N+1", "First Name", "Last Name", "Employment Start", "Organization", "Title"],
            [["Youssef", "Amina", "Mansour", "2021-02-01", "Ops", "Lead"], ["Karim", "Sami", "Ali", "2020-01-01", "Ops", "Dev"]],
            new WorkforceImportInterpretation(
                new Dictionary<int, WorkforceImportField> { [0] = WorkforceImportField.Manager }, null, WorkforceDateFormat.Iso));
        Assert.Contains(result.Mappings, m => m.ColumnIndex == 0 && m.Field == WorkforceImportField.Manager && m.Origin == "administrator");
        Assert.Equal("Youssef", result.Rows[0].ManagerReference);
        Assert.Equal("Karim", result.Rows[1].ManagerReference);
    }
}

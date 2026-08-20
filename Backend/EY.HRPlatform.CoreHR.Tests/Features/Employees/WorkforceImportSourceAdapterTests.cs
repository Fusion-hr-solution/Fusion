using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public sealed class WorkforceImportSourceAdapterTests
{
    private readonly WorkforceImportSourceAdapter _adapter = new();

    private static TabularSourceInspection Inspection(TabularSourceSheet? selected, params TabularSourceSheet[] usable)
        => new("f.xlsx", "xlsx", "application/x", "sha", 100, usable, selected, [1]);

    private static TabularSourceSheet Sheet(string name, params string?[] headers)
        => new(name, "A1:B2", new TabularSourceTable(
            headers.Select((h, i) => new TabularSourceColumn(i, h)).ToList(),
            [["v1", "v2"], ["v3", "v4"]]), 2, headers.Length);

    [Fact]
    public void No_selected_sheet_requires_sheet_selection()
    {
        var shape = _adapter.Adapt(Inspection(null, Sheet("Employees", "A", "B"), Sheet("Notes", "X", "Y")));
        Assert.True(shape.SheetSelectionRequired);
        Assert.Null(shape.Selected);
        Assert.Equal(2, shape.Sheets.Count);
        Assert.Contains(shape.Sheets, s => s.Name == "Employees");
    }

    [Fact]
    public void Selected_sheet_maps_columns_and_one_row_per_source_row()
    {
        var sheet = Sheet("Employees", "Employee Number", "First Name");
        var shape = _adapter.Adapt(Inspection(sheet, sheet));
        Assert.False(shape.SheetSelectionRequired);
        Assert.False(shape.HeaderClarificationRequired);
        Assert.NotNull(shape.Selected);
        Assert.Equal(2, shape.Selected!.Rows.Count);
        Assert.Equal(1, shape.Selected.Rows[0].SourceRowNumber);
        Assert.Equal(2, shape.Selected.Rows[1].SourceRowNumber);
        Assert.Contains("Employee Number", shape.Selected.ColumnsJson);
    }

    [Fact]
    public void Single_confident_header_auto_proceeds_past_a_title_row()
    {
        // Row 0 is a title; row 1 is the real header — one confident header → no clarification.
        var sheet = new TabularSourceSheet("Employees", "A1:C3", new TabularSourceTable(
            [new TabularSourceColumn(0, "Company Export"), new TabularSourceColumn(1, null), new TabularSourceColumn(2, null)],
            [["Employee Number", "First Name", "Department"], ["001", "Amina", "Ops"]]), 2, 3);
        var shape = _adapter.Adapt(Inspection(sheet, sheet));
        Assert.False(shape.HeaderClarificationRequired);
        Assert.Single(shape.Selected!.Rows);
        Assert.Contains("Employee Number", shape.Selected.ColumnsJson);
    }

    [Fact]
    public void Multiple_plausible_headers_require_clarification_then_selection_resumes()
    {
        var sheet = new TabularSourceSheet("Employees", "A1:C3", new TabularSourceTable(
            [new TabularSourceColumn(0, "Employee Number"), new TabularSourceColumn(1, "First Name"), new TabularSourceColumn(2, "Department")],
            [["Matricule", "Prénom", "Département"], ["001", "Amina", "Ops"]]), 2, 3);

        var ambiguous = _adapter.Adapt(Inspection(sheet, sheet));
        Assert.True(ambiguous.HeaderClarificationRequired);
        Assert.Null(ambiguous.Selected);
        Assert.Equal([0, 1], ambiguous.HeaderCandidates.Select(c => c.RowIndex).ToArray());

        var chosen = _adapter.Adapt(Inspection(sheet, sheet), headerRowIndex: 1);
        Assert.False(chosen.HeaderClarificationRequired);
        Assert.Single(chosen.Selected!.Rows); // only the real data row remains
        Assert.Contains("Matricule", chosen.Selected.ColumnsJson);
    }
}

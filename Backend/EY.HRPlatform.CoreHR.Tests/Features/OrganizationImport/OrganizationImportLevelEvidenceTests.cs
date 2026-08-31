using EY.HRPlatform.CoreHR.Features.OrganizationImport;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class OrganizationImportLevelEvidenceTests
{
    // Four genuine levels (Entity → Strategic Pillar → Capability → Delivery Pod) with a
    // leading sequential "index" column the export carried along. The index must be dropped
    // from the hierarchy, not treated as the top of the organization.
    private static OrganizationSourceTable AsteriaWithIndex() => new(
        [new(0, "index"), new(1, "Entity"), new(2, "Strategic Pillar"), new(3, "Capability"), new(4, "Delivery Pod")],
        [
            new string?[] { "0", "Asteria Group", "Customer Growth", "Customer Experience", "Journey Design Pod" },
            new string?[] { "1", "Asteria Group", "Customer Growth", "Revenue Operations", "North Market Pod" },
            new string?[] { "2", "Asteria Group", "Customer Growth", "Revenue Operations", "South Market Pod" },
            new string?[] { "3", "Asteria Group", "Digital Foundations", "Data Products", "Governance Pod" },
            new string?[] { "4", "Asteria Group", "Digital Foundations", "Data Products", "Insights Pod" },
            new string?[] { "5", "Asteria Group", "Digital Foundations", "Enterprise Platforms", "Core Systems Pod" },
            new string?[] { "6", "Asteria Group", "Operational Excellence", "Finance Operations", "Planning Pod" },
            new string?[] { "7", "Asteria Group", "Operational Excellence", "People Operations", "Talent Pod" },
            new string?[] { "8", "Asteria Group", "Operational Excellence", "People Operations", "Workplace Pod" },
        ]);

    [Fact]
    public void LeadingSequentialIndexColumn_IsDroppedFromLevels()
    {
        var levels = OrganizationImportLevelEvidence.SelectLevelColumns(AsteriaWithIndex(), out var ignored);

        Assert.Equal(new[] { 1, 2, 3, 4 }, levels);
        var ignoredColumn = Assert.Single(ignored);
        Assert.Equal(0, ignoredColumn.ColumnIndex);
        Assert.Equal("index", ignoredColumn.Label);
    }

    [Fact]
    public void AsteriaWithIndex_ResolvesDeterministicallyAsLevelColumns()
    {
        Assert.True(OrganizationImportLevelEvidence.IsLevelColumnsTable(AsteriaWithIndex()));
    }

    [Fact]
    public void CleanLevelTable_KeepsEveryColumn_AndReportsNoIgnoredColumns()
    {
        var table = new OrganizationSourceTable(
            [new(0, "Entity"), new(1, "Strategic Pillar"), new(2, "Capability"), new(3, "Delivery Pod")],
            [
                new string?[] { "Asteria Group", "Customer Growth", "Customer Experience", "Journey Design Pod" },
                new string?[] { "Asteria Group", "Customer Growth", "Revenue Operations", "North Market Pod" },
                new string?[] { "Asteria Group", "Digital Foundations", "Data Products", "Governance Pod" },
            ]);

        var levels = OrganizationImportLevelEvidence.SelectLevelColumns(table, out var ignored);

        Assert.Equal(new[] { 0, 1, 2, 3 }, levels);
        Assert.Empty(ignored);
        Assert.True(OrganizationImportLevelEvidence.IsLevelColumnsTable(table));
    }

    [Theory]
    [InlineData("No.")]
    [InlineData("#")]
    [InlineData("Record ID")]
    [InlineData("Row")]
    public void IdentifierHeaderColumn_IsDropped(string header)
    {
        var table = new OrganizationSourceTable(
            [new(0, header), new(1, "Division"), new(2, "Department"), new(3, "Team")],
            [
                new string?[] { "R-001", "East", "Sales", "Alpha" },
                new string?[] { "R-002", "East", "Sales", "Beta" },
                new string?[] { "R-003", "West", "Support", "Gamma" },
            ]);

        var levels = OrganizationImportLevelEvidence.SelectLevelColumns(table, out var ignored);

        Assert.Equal(new[] { 1, 2, 3 }, levels);
        Assert.Equal(0, Assert.Single(ignored).ColumnIndex);
    }

    [Fact]
    public void AllDistinctLeafColumn_IsNeverDropped()
    {
        // The finest level is unique per row by nature; it is the leaf, not a row key.
        var table = new OrganizationSourceTable(
            [new(0, "Division"), new(1, "Department"), new(2, "Team")],
            [
                new string?[] { "East", "Sales", "Alpha" },
                new string?[] { "East", "Support", "Beta" },
                new string?[] { "West", "Sales", "Gamma" },
            ]);

        var levels = OrganizationImportLevelEvidence.SelectLevelColumns(table, out var ignored);

        Assert.Equal(new[] { 0, 1, 2 }, levels);
        Assert.Empty(ignored);
    }

    [Fact]
    public void OverFiltering_NeverLeavesFewerThanTwoLevels()
    {
        // Two unique-per-row numeric columns: dropping both would leave no hierarchy, so the
        // helper must keep the raw columns rather than fabricate a shape from nothing.
        var table = new OrganizationSourceTable(
            [new(0, "a"), new(1, "b")],
            [
                new string?[] { "1", "10" },
                new string?[] { "2", "20" },
                new string?[] { "3", "30" },
            ]);

        var levels = OrganizationImportLevelEvidence.SelectLevelColumns(table, out var ignored);

        Assert.Equal(new[] { 0, 1 }, levels);
        Assert.Empty(ignored);
    }

    [Fact]
    public void ParentReferenceTable_IsNotReadAsLevelColumns()
    {
        // A self-referential foreign key is a parent-reference table; the level heuristic must
        // not claim it (the interpreter resolves parent-reference first, but this stays honest).
        var table = new OrganizationSourceTable(
            [new(0, "OU Ref"), new(1, "Org Label"), new(2, "Rolls Up To")],
            [
                new string?[] { "AG", "Asteria Group", null },
                new string?[] { "CG", "Customer Growth", "AG" },
                new string?[] { "CE", "Customer Experience", "CG" },
            ]);

        Assert.True(OrganizationImportShapeEvidence.HasParentReferenceStructure(table));
    }
}

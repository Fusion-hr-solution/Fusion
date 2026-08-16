using EY.HRPlatform.CoreHR.Features.OrganizationImport;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class OrganizationImportShapeEvidenceTests
{
    [Fact]
    public void SelfReferencingForeignKey_IsRecognizedAsParentReference()
    {
        var table = new OrganizationSourceTable(
            [new(0, "OU Ref"), new(1, "Org Label"), new(2, "Classification"), new(3, "Rolls Up To")],
            [
                new string?[] { "AG", "Asteria Group", "Organization", null },
                new string?[] { "CG", "Customer Growth", "Division", "AG" },
                new string?[] { "CE", "Customer Experience", "Department", "CG" },
                new string?[] { "CX", "Experience Pod", "Team", "CE" },
            ]);

        Assert.True(OrganizationImportShapeEvidence.TryFindParentReference(
            table, null, out var identifierColumn, out var parentColumn));
        Assert.Equal(0, identifierColumn);
        Assert.Equal(3, parentColumn);
    }

    [Fact]
    public void LevelColumnPathEnumeration_HasNoParentReference()
    {
        // Rectangular, but no column references another identifier column — the level
        // values repeat down the rows. This must not read as a parent-reference table.
        var table = new OrganizationSourceTable(
            [new(0, "Entity"), new(1, "Strategic Pillar"), new(2, "Capability"), new(3, "Delivery Pod")],
            [
                new string?[] { "Asteria", "Customer Growth", "Sales Enablement", "North Pod" },
                new string?[] { "Asteria", "Customer Growth", "Sales Enablement", "South Pod" },
                new string?[] { "Asteria", "Operational Excellence", "People Operations", "Talent Pod" },
            ]);

        Assert.False(OrganizationImportShapeEvidence.HasParentReferenceStructure(table));
    }

    [Fact]
    public void SingleReference_IsTooWeakToBeParentReference()
    {
        // One shared value is coincidence, not a foreign key.
        var table = new OrganizationSourceTable(
            [new(0, "Code"), new(1, "Parent")],
            [
                new string?[] { "A", null },
                new string?[] { "B", "A" },
            ]);

        Assert.False(OrganizationImportShapeEvidence.HasParentReferenceStructure(table));
    }

    [Fact]
    public void ReferenceOutsideIdentifierColumn_IsNotParentReference()
    {
        // The "parent" column points at values that are not the identifier set.
        var table = new OrganizationSourceTable(
            [new(0, "Code"), new(1, "Parent")],
            [
                new string?[] { "A", "X" },
                new string?[] { "B", "Y" },
                new string?[] { "C", "Z" },
            ]);

        Assert.False(OrganizationImportShapeEvidence.HasParentReferenceStructure(table));
    }
}

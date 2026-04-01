using EY.HRPlatform.CoreHR.Domain.Entities;

namespace EY.HRPlatform.CoreHR.Tests.Domain;

public class OrgUnitTests
{
    private static readonly Guid ValidTenantId = Guid.NewGuid();

    #region Create Tests

    [Fact]
    public void Create_WithValidInputs_ReturnsOrgUnit()
    {
        // Act
        var orgUnit = OrgUnit.Create(ValidTenantId, "ENG", "Engineering", "Department", null);

        // Assert
        Assert.Equal(ValidTenantId, orgUnit.TenantId);
        Assert.Equal("ENG", orgUnit.Code);
        Assert.Equal("Engineering", orgUnit.Name);
        Assert.Equal("Department", orgUnit.Type);
        Assert.Null(orgUnit.ParentId);
        Assert.True(orgUnit.IsActive);
    }

    [Fact]
    public void Create_WithParentId_SetsParentId()
    {
        // Arrange
        var parentId = Guid.NewGuid();

        // Act
        var orgUnit = OrgUnit.Create(ValidTenantId, "ENG-TEAM", "Engineering Team", "Team", parentId);

        // Assert
        Assert.Equal(parentId, orgUnit.ParentId);
    }

    [Fact]
    public void Create_NormalizesCode_ToUpperCaseAndTrimmed()
    {
        // Act
        var orgUnit = OrgUnit.Create(ValidTenantId, "  eng-001  ", "Engineering", "Department", null);

        // Assert
        Assert.Equal("ENG-001", orgUnit.Code);
    }

    [Fact]
    public void Create_TrimsNameButPreservesCase()
    {
        // Act
        var orgUnit = OrgUnit.Create(ValidTenantId, "ENG", "  Engineering Department  ", "Department", null);

        // Assert
        Assert.Equal("Engineering Department", orgUnit.Name);
    }

    [Fact]
    public void Create_WithEmptyTenantId_ThrowsArgumentException()
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            OrgUnit.Create(Guid.Empty, "ENG", "Engineering", "Department", null));

        Assert.Equal("tenantId", ex.ParamName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidCode_ThrowsArgumentException(string? code)
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            OrgUnit.Create(ValidTenantId, code!, "Engineering", "Department", null));

        Assert.Equal("code", ex.ParamName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidName_ThrowsArgumentException(string? name)
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            OrgUnit.Create(ValidTenantId, "ENG", name!, "Department", null));

        Assert.Equal("name", ex.ParamName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidType_ThrowsArgumentException(string? type)
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            OrgUnit.Create(ValidTenantId, "ENG", "Engineering", type!, null));

        Assert.Equal("type", ex.ParamName);
    }

    [Fact]
    public void Create_WithCodeExceedingMaxLength_ThrowsArgumentException()
    {
        // Arrange
        var longCode = new string('A', 51);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            OrgUnit.Create(ValidTenantId, longCode, "Engineering", "Department", null));

        Assert.Equal("code", ex.ParamName);
        Assert.Contains("50", ex.Message);
    }

    [Fact]
    public void Create_WithNameExceedingMaxLength_ThrowsArgumentException()
    {
        // Arrange
        var longName = new string('A', 201);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            OrgUnit.Create(ValidTenantId, "ENG", longName, "Department", null));

        Assert.Equal("name", ex.ParamName);
        Assert.Contains("200", ex.Message);
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_WithValidInputs_UpdatesFields()
    {
        // Arrange
        var orgUnit = OrgUnit.Create(ValidTenantId, "ENG", "Engineering", "Department", null);
        var newParentId = Guid.NewGuid();

        // Act
        orgUnit.Update("Engineering Division", "Division", newParentId);

        // Assert
        Assert.Equal("Engineering Division", orgUnit.Name);
        Assert.Equal("Division", orgUnit.Type);
        Assert.Equal(newParentId, orgUnit.ParentId);
        Assert.Equal("ENG", orgUnit.Code); // Code is immutable
    }

    [Fact]
    public void Update_CanClearParentId()
    {
        // Arrange
        var parentId = Guid.NewGuid();
        var orgUnit = OrgUnit.Create(ValidTenantId, "TEAM", "Team", "Team", parentId);

        // Act
        orgUnit.Update("Team", "Team", null);

        // Assert
        Assert.Null(orgUnit.ParentId);
    }

    [Fact]
    public void Update_WithSelfAsParent_ThrowsArgumentException()
    {
        // Arrange
        var orgUnit = OrgUnit.Create(ValidTenantId, "ENG", "Engineering", "Department", null);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            orgUnit.Update("Engineering", "Department", orgUnit.Id));

        Assert.Equal("parentId", ex.ParamName);
        Assert.Contains("own parent", ex.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Update_WithInvalidName_ThrowsArgumentException(string? name)
    {
        // Arrange
        var orgUnit = OrgUnit.Create(ValidTenantId, "ENG", "Engineering", "Department", null);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            orgUnit.Update(name!, "Department", null));

        Assert.Equal("name", ex.ParamName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Update_WithInvalidType_ThrowsArgumentException(string? type)
    {
        // Arrange
        var orgUnit = OrgUnit.Create(ValidTenantId, "ENG", "Engineering", "Department", null);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            orgUnit.Update("Engineering", type!, null));

        Assert.Equal("type", ex.ParamName);
    }

    #endregion

    #region Activate/Deactivate Tests

    [Fact]
    public void Deactivate_WhenActive_SetsIsActiveToFalse()
    {
        // Arrange
        var orgUnit = OrgUnit.Create(ValidTenantId, "ENG", "Engineering", "Department", null);

        // Act
        orgUnit.Deactivate();

        // Assert
        Assert.False(orgUnit.IsActive);
    }

    [Fact]
    public void Deactivate_WhenAlreadyInactive_ThrowsInvalidOperationException()
    {
        // Arrange
        var orgUnit = OrgUnit.Create(ValidTenantId, "ENG", "Engineering", "Department", null);
        orgUnit.Deactivate();

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => orgUnit.Deactivate());
        Assert.Contains("already inactive", ex.Message);
    }

    [Fact]
    public void Activate_WhenInactive_SetsIsActiveToTrue()
    {
        // Arrange
        var orgUnit = OrgUnit.Create(ValidTenantId, "ENG", "Engineering", "Department", null);
        orgUnit.Deactivate();

        // Act
        orgUnit.Activate();

        // Assert
        Assert.True(orgUnit.IsActive);
    }

    [Fact]
    public void Activate_WhenAlreadyActive_ThrowsInvalidOperationException()
    {
        // Arrange
        var orgUnit = OrgUnit.Create(ValidTenantId, "ENG", "Engineering", "Department", null);

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => orgUnit.Activate());
        Assert.Contains("already active", ex.Message);
    }

    #endregion
}

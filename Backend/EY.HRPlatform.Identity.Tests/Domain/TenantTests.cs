using EY.HRPlatform.Identity.Domain.Entities;

namespace EY.HRPlatform.Identity.Tests.Domain;

public class TenantTests
{
    [Fact]
    public void Create_WithValidIdAndName_ReturnsTenant()
    {
        // Arrange
        var id = Guid.NewGuid();
        var name = "Test Tenant";

        // Act
        var tenant = Tenant.Create(id, name);

        // Assert
        Assert.Equal(id, tenant.Id);
        Assert.Equal(name, tenant.Name);
        Assert.True(tenant.IsActive);
        Assert.True(tenant.CreatedAt <= DateTime.UtcNow);
        Assert.Null(tenant.UpdatedAt);
    }

    [Fact]
    public void Create_WithValidName_GeneratesId()
    {
        // Arrange
        var name = "Test Tenant";

        // Act
        var tenant = Tenant.Create(name);

        // Assert
        Assert.NotEqual(Guid.Empty, tenant.Id);
        Assert.Equal(name, tenant.Name);
    }

    [Fact]
    public void Create_WithEmptyId_ThrowsArgumentException()
    {
        // Arrange
        var id = Guid.Empty;
        var name = "Test Tenant";

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() => Tenant.Create(id, name));
        Assert.Contains("Id cannot be empty", ex.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithNullOrWhitespaceName_ThrowsArgumentException(string? name)
    {
        // Arrange
        var id = Guid.NewGuid();

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() => Tenant.Create(id, name!));
        Assert.Contains("Name is required", ex.Message);
    }

    [Theory]
    [InlineData("A")]
    public void Create_WithNameTooShort_ThrowsArgumentException(string name)
    {
        // Arrange
        var id = Guid.NewGuid();

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() => Tenant.Create(id, name));
        Assert.Contains("2-100 characters", ex.Message);
    }

    [Fact]
    public void Create_WithNameTooLong_ThrowsArgumentException()
    {
        // Arrange
        var id = Guid.NewGuid();
        var name = new string('A', 101);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() => Tenant.Create(id, name));
        Assert.Contains("2-100 characters", ex.Message);
    }

    [Fact]
    public void Create_TrimsName()
    {
        // Arrange
        var id = Guid.NewGuid();
        var name = "  Test Tenant  ";

        // Act
        var tenant = Tenant.Create(id, name);

        // Assert
        Assert.Equal("Test Tenant", tenant.Name);
    }

    [Fact]
    public void Update_WithValidName_UpdatesNameAndTimestamp()
    {
        // Arrange
        var tenant = Tenant.Create(Guid.NewGuid(), "Original Name");
        var originalCreatedAt = tenant.CreatedAt;

        // Act
        tenant.Update("Updated Name");

        // Assert
        Assert.Equal("Updated Name", tenant.Name);
        Assert.Equal(originalCreatedAt, tenant.CreatedAt);
        Assert.NotNull(tenant.UpdatedAt);
        Assert.True(tenant.UpdatedAt <= DateTime.UtcNow);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Update_WithInvalidName_ThrowsArgumentException(string? name)
    {
        // Arrange
        var tenant = Tenant.Create(Guid.NewGuid(), "Original Name");

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() => tenant.Update(name!));
        Assert.Contains("Name is required", ex.Message);
    }

    [Fact]
    public void Deactivate_SetsIsActiveToFalseAndUpdatesTimestamp()
    {
        // Arrange
        var tenant = Tenant.Create(Guid.NewGuid(), "Test Tenant");

        // Act
        tenant.Deactivate();

        // Assert
        Assert.False(tenant.IsActive);
        Assert.NotNull(tenant.UpdatedAt);
    }

    [Fact]
    public void Reactivate_SetsIsActiveToTrueAndUpdatesTimestamp()
    {
        // Arrange
        var tenant = Tenant.Create(Guid.NewGuid(), "Test Tenant");
        tenant.Deactivate();

        // Act
        tenant.Reactivate();

        // Assert
        Assert.True(tenant.IsActive);
        Assert.NotNull(tenant.UpdatedAt);
    }
}

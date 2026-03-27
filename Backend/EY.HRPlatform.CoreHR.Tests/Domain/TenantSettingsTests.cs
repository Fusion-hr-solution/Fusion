using EY.HRPlatform.CoreHR.Domain.Entities;

namespace EY.HRPlatform.CoreHR.Tests.Domain;

public class TenantSettingsTests
{
    private static readonly Guid ValidTenantId = Guid.NewGuid();

    #region Create Tests

    [Fact]
    public void Create_WithValidTenantId_ReturnsTenantSettings()
    {
        // Act
        var settings = TenantSettings.Create(ValidTenantId);

        // Assert
        Assert.Equal(ValidTenantId, settings.TenantId);
        Assert.Null(settings.SettingsOverrides);
        Assert.NotEqual(Guid.Empty, settings.Id);
    }

    [Fact]
    public void Create_WithOverrides_StoresOverrides()
    {
        // Arrange
        var overrides = """{"orgUnitTypes":["Division"]}""";

        // Act
        var settings = TenantSettings.Create(ValidTenantId, overrides);

        // Assert
        Assert.Equal(overrides, settings.SettingsOverrides);
    }

    [Fact]
    public void Create_WithEmptyTenantId_ThrowsArgumentException()
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            TenantSettings.Create(Guid.Empty));

        Assert.Equal("tenantId", ex.ParamName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\n")]
    public void Create_WithEmptyOrWhitespaceOverrides_NormalizesToNull(string? overrides)
    {
        // Act
        var settings = TenantSettings.Create(ValidTenantId, overrides);

        // Assert
        Assert.Null(settings.SettingsOverrides);
    }

    #endregion

    #region UpdateOverrides Tests

    [Fact]
    public void UpdateOverrides_WithValidJson_UpdatesSettingsAndTimestamp()
    {
        // Arrange
        var settings = TenantSettings.Create(ValidTenantId);
        var initialUpdatedAt = settings.UpdatedAt;
        var overrides = """{"branding":{"primaryColor":"#ff0000"}}""";

        // Act
        settings.UpdateOverrides(overrides);

        // Assert
        Assert.Equal(overrides, settings.SettingsOverrides);
        Assert.NotNull(settings.UpdatedAt);
        Assert.NotEqual(initialUpdatedAt, settings.UpdatedAt);
    }

    [Fact]
    public void UpdateOverrides_WithNull_ClearsOverrides()
    {
        // Arrange
        var settings = TenantSettings.Create(ValidTenantId, """{"test":"value"}""");

        // Act
        settings.UpdateOverrides(null);

        // Assert
        Assert.Null(settings.SettingsOverrides);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t")]
    public void UpdateOverrides_WithEmptyOrWhitespace_NormalizesToNull(string? overrides)
    {
        // Arrange
        var settings = TenantSettings.Create(ValidTenantId, """{"existing":"value"}""");

        // Act
        settings.UpdateOverrides(overrides);

        // Assert
        Assert.Null(settings.SettingsOverrides);
    }

    [Fact]
    public void UpdateOverrides_SetsUpdatedAtToUtcNow()
    {
        // Arrange
        var settings = TenantSettings.Create(ValidTenantId);
        var beforeUpdate = DateTime.UtcNow;

        // Act
        settings.UpdateOverrides("""{"test":"value"}""");

        // Assert
        Assert.NotNull(settings.UpdatedAt);
        Assert.True(settings.UpdatedAt >= beforeUpdate);
        Assert.True(settings.UpdatedAt <= DateTime.UtcNow);
    }

    #endregion
}

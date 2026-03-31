using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;

namespace EY.HRPlatform.CoreHR.Tests.Features.TenantSettings;

public class TenantSettingsMergerTests
{
    [Fact]
    public void Merge_WithNullOverrides_ReturnsDefaults()
    {
        // Act
        var result = TenantSettingsMerger.Merge(null);

        // Assert
        Assert.Equal(TenantSettingsDto.Defaults.OrgUnitTypes, result.OrgUnitTypes);
        Assert.Equal(TenantSettingsDto.Defaults.EmployeeFieldConfig, result.EmployeeFieldConfig);
        Assert.Equal(TenantSettingsDto.Defaults.Branding.PrimaryColor, result.Branding.PrimaryColor);
    }

    [Fact]
    public void Merge_WithEmptyOverrides_ReturnsDefaults()
    {
        // Act
        var result = TenantSettingsMerger.Merge("");

        // Assert
        Assert.Equal(TenantSettingsDto.Defaults.OrgUnitTypes, result.OrgUnitTypes);
    }

    [Fact]
    public void Merge_WithWhitespaceOverrides_ReturnsDefaults()
    {
        // Act
        var result = TenantSettingsMerger.Merge("   ");

        // Assert
        Assert.Equal(TenantSettingsDto.Defaults.OrgUnitTypes, result.OrgUnitTypes);
    }

    [Fact]
    public void Merge_WithPartialOrgUnitTypesOverride_OverridesOrgUnitTypes()
    {
        // Arrange
        var overrides = """{"orgUnitTypes":["Division","Department","Team"]}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.Equal(["Division", "Department", "Team"], result.OrgUnitTypes);
        // Other fields should be defaults
        Assert.Equal(TenantSettingsDto.Defaults.EmployeeFieldConfig.Count, result.EmployeeFieldConfig.Count);
    }

    [Fact]
    public void Merge_WithPartialBrandingOverride_MergesBranding()
    {
        // Arrange
        var overrides = """{"branding":{"primaryColor":"#ff0000"}}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.Equal("#ff0000", result.Branding.PrimaryColor);
        Assert.Null(result.Branding.LogoUrl); // Default is null
    }

    [Fact]
    public void Merge_WithLogoUrlOverride_SetsLogoUrl()
    {
        // Arrange
        var overrides = """{"branding":{"logoUrl":"https://example.com/logo.png"}}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.Equal("https://example.com/logo.png", result.Branding.LogoUrl);
        Assert.Equal(TenantSettingsDto.Defaults.Branding.PrimaryColor, result.Branding.PrimaryColor);
    }

    [Fact]
    public void Merge_WithPrimaryColorOnlyBrandingOverride_PreservesDefaultLogoUrl()
    {
        // Arrange
        var overrides = """{"branding":{"primaryColor":"#00ff00"}}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.Null(result.Branding.LogoUrl);
        Assert.Equal("#00ff00", result.Branding.PrimaryColor);
    }

    [Fact]
    public void Merge_WithPartialFieldConfigOverride_MergesFieldConfig()
    {
        // Arrange - override just one field
        var overrides = """{"employeeFieldConfig":{"phone":{"visible":false,"required":false}}}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.False(result.EmployeeFieldConfig["phone"].Visible);
        // Other fields should still be defaults
        Assert.True(result.EmployeeFieldConfig["firstName"].Visible);
        Assert.True(result.EmployeeFieldConfig["firstName"].Required);
    }

    [Fact]
    public void Merge_WithPartialFieldConfigMissingRequired_PreservesDefaultRequired()
    {
        // Arrange - required is omitted, should preserve default false for phone
        var overrides = """{"employeeFieldConfig":{"phone":{"visible":true}}}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.True(result.EmployeeFieldConfig["phone"].Visible);
        Assert.False(result.EmployeeFieldConfig["phone"].Required);
    }

    [Fact]
    public void Merge_WithPartialFieldConfigMissingVisible_PreservesDefaultVisible()
    {
        // Arrange - visible is omitted, should preserve default true for firstName
        var overrides = """{"employeeFieldConfig":{"firstName":{"required":false}}}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.True(result.EmployeeFieldConfig["firstName"].Visible);
        Assert.False(result.EmployeeFieldConfig["firstName"].Required);
    }

    [Fact]
    public void Merge_WithFullOverride_AppliesAllOverrides()
    {
        // Arrange
        var overrides = """
        {
            "orgUnitTypes": ["HQ"],
            "employeeFieldConfig": {
                "firstName": {"visible": true, "required": true},
                "email": {"visible": false, "required": false}
            },
            "branding": {
                "logoUrl": "https://example.com/logo.png",
                "primaryColor": "#123456"
            }
        }
        """;

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.Equal(["HQ"], result.OrgUnitTypes);
        Assert.False(result.EmployeeFieldConfig["email"].Visible);
        Assert.Equal("#123456", result.Branding.PrimaryColor);
        Assert.Equal("https://example.com/logo.png", result.Branding.LogoUrl);
    }

    [Fact]
    public void Merge_WithInvalidJson_ThrowsJsonException()
    {
        // Arrange - invalid JSON should throw since it indicates data corruption
        var overrides = "not valid json";

        // Act & Assert
        Assert.Throws<System.Text.Json.JsonException>(() => 
            TenantSettingsMerger.Merge(overrides));
    }

    #region Per-Role Visibility Tests

    [Fact]
    public void Merge_WithNullOverrides_RoleVisibilityDefaultsToTrue()
    {
        // Act
        var result = TenantSettingsMerger.Merge(null);

        // Assert
        foreach (var (_, config) in result.EmployeeFieldConfig)
        {
            Assert.True(config.VisibleToEmployee);
            Assert.True(config.VisibleToManager);
        }
    }

    [Fact]
    public void Merge_WithVisibleToEmployeeOverride_AppliesOverride()
    {
        // Arrange
        var overrides = """{"employeeFieldConfig":{"phone":{"visibleToEmployee":false}}}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.False(result.EmployeeFieldConfig["phone"].VisibleToEmployee);
        Assert.True(result.EmployeeFieldConfig["phone"].VisibleToManager); // Default
        Assert.True(result.EmployeeFieldConfig["phone"].Visible); // Default
    }

    [Fact]
    public void Merge_WithVisibleToManagerOverride_AppliesOverride()
    {
        // Arrange
        var overrides = """{"employeeFieldConfig":{"jobTitle":{"visibleToManager":false}}}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.True(result.EmployeeFieldConfig["jobTitle"].VisibleToEmployee); // Default
        Assert.False(result.EmployeeFieldConfig["jobTitle"].VisibleToManager);
        Assert.True(result.EmployeeFieldConfig["jobTitle"].Visible); // Default
    }

    [Fact]
    public void Merge_WithBothRoleVisibilityOverrides_AppliesBoth()
    {
        // Arrange
        var overrides = """{"employeeFieldConfig":{"hireDate":{"visibleToEmployee":false,"visibleToManager":true}}}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.False(result.EmployeeFieldConfig["hireDate"].VisibleToEmployee);
        Assert.True(result.EmployeeFieldConfig["hireDate"].VisibleToManager);
    }

    [Fact]
    public void Merge_WithAllFieldConfigOverrides_AppliesAll()
    {
        // Arrange
        var overrides = """
        {
            "employeeFieldConfig": {
                "phone": {
                    "visible": false,
                    "required": false,
                    "visibleToEmployee": false,
                    "visibleToManager": true
                }
            }
        }
        """;

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.False(result.EmployeeFieldConfig["phone"].Visible);
        Assert.False(result.EmployeeFieldConfig["phone"].Required);
        Assert.False(result.EmployeeFieldConfig["phone"].VisibleToEmployee);
        Assert.True(result.EmployeeFieldConfig["phone"].VisibleToManager);
    }

    [Fact]
    public void Merge_WithPartialRoleVisibility_PreservesDefaults()
    {
        // Arrange - only visibleToEmployee is set, visibleToManager should default to true
        var overrides = """{"employeeFieldConfig":{"jobTitle":{"visibleToEmployee":false}}}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert
        Assert.False(result.EmployeeFieldConfig["jobTitle"].VisibleToEmployee);
        Assert.True(result.EmployeeFieldConfig["jobTitle"].VisibleToManager); // Default preserved
        Assert.True(result.EmployeeFieldConfig["jobTitle"].Visible); // Default preserved
        Assert.False(result.EmployeeFieldConfig["jobTitle"].Required); // Original default
    }

    [Fact]
    public void Merge_RoleVisibilityDoesNotAffectOtherFields()
    {
        // Arrange - set role visibility for phone
        var overrides = """{"employeeFieldConfig":{"phone":{"visibleToEmployee":false}}}""";

        // Act
        var result = TenantSettingsMerger.Merge(overrides);

        // Assert - firstName should be completely default
        Assert.True(result.EmployeeFieldConfig["firstName"].Visible);
        Assert.True(result.EmployeeFieldConfig["firstName"].Required);
        Assert.True(result.EmployeeFieldConfig["firstName"].VisibleToEmployee);
        Assert.True(result.EmployeeFieldConfig["firstName"].VisibleToManager);
    }

    #endregion
}

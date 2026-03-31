using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using System.Text.Json;

namespace EY.HRPlatform.CoreHR.Tests.Features.TenantSettings;

public class TenantSettingsOverrideBuilderTests
{
    [Fact]
    public void Build_WithAllNulls_ReturnsNull()
    {
        // Act
        var result = TenantSettingsOverrideBuilder.Build(null, null, null, null);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void Build_WithEmptyExistingAndAllNulls_ReturnsNull()
    {
        // Act
        var result = TenantSettingsOverrideBuilder.Build("", null, null, null);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void Build_WithOrgUnitTypes_ReturnsJsonWithOrgUnitTypes()
    {
        // Act
        var result = TenantSettingsOverrideBuilder.Build(
            null,
            ["Division", "Department"],
            null,
            null);

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var orgUnitTypes = json.RootElement.GetProperty("orgUnitTypes");
        Assert.Equal(2, orgUnitTypes.GetArrayLength());
        Assert.Equal("Division", orgUnitTypes[0].GetString());
        Assert.Equal("Department", orgUnitTypes[1].GetString());
    }

    [Fact]
    public void Build_WithBranding_ReturnsJsonWithBranding()
    {
        // Act
        var result = TenantSettingsOverrideBuilder.Build(
            null,
            null,
            null,
            new BrandingSettingsInput(LogoUrl: null, PrimaryColor: "#ff0000"));

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var branding = json.RootElement.GetProperty("branding");
        Assert.Equal("#ff0000", branding.GetProperty("primaryColor").GetString());
    }

    [Fact]
    public void Build_WithFieldConfig_ReturnsJsonWithFieldConfig()
    {
        // Act
        var result = TenantSettingsOverrideBuilder.Build(
            null,
            null,
            new Dictionary<string, FieldConfigInput>
            {
                ["phone"] = new FieldConfigInput(false, true, null, null)
            },
            null);

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var fieldConfig = json.RootElement.GetProperty("employeeFieldConfig");
        var phone = fieldConfig.GetProperty("phone");
        Assert.False(phone.GetProperty("visible").GetBoolean());
        Assert.True(phone.GetProperty("required").GetBoolean());
    }

    [Fact]
    public void Build_MergesWithExistingOverrides()
    {
        // Arrange
        var existing = """{"orgUnitTypes":["Existing"],"branding":{"primaryColor":"#111111"}}""";

        // Act - add new branding, keep existing org types
        var result = TenantSettingsOverrideBuilder.Build(
            existing,
            null,
            null,
            new BrandingSettingsInput(null, "#222222"));

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        
        // Org types should be preserved
        var orgTypes = json.RootElement.GetProperty("orgUnitTypes");
        Assert.Equal("Existing", orgTypes[0].GetString());
        
        // Branding should be updated
        var branding = json.RootElement.GetProperty("branding");
        Assert.Equal("#222222", branding.GetProperty("primaryColor").GetString());
    }

    [Fact]
    public void Build_OverwritesExistingOrgUnitTypes()
    {
        // Arrange
        var existing = """{"orgUnitTypes":["Old"]}""";

        // Act
        var result = TenantSettingsOverrideBuilder.Build(
            existing,
            ["New1", "New2"],
            null,
            null);

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var orgTypes = json.RootElement.GetProperty("orgUnitTypes");
        Assert.Equal(2, orgTypes.GetArrayLength());
        Assert.Equal("New1", orgTypes[0].GetString());
    }

    [Fact]
    public void Build_MergesFieldConfigPartially()
    {
        // Arrange - existing has firstName config
        var existing = """{"employeeFieldConfig":{"firstName":{"visible":true,"required":true}}}""";

        // Act - update phone, should preserve firstName
        var result = TenantSettingsOverrideBuilder.Build(
            existing,
            null,
            new Dictionary<string, FieldConfigInput>
            {
                ["phone"] = new FieldConfigInput(false, null, null, null)
            },
            null);

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var fieldConfig = json.RootElement.GetProperty("employeeFieldConfig");
        
        // firstName should be preserved
        Assert.True(fieldConfig.GetProperty("firstName").GetProperty("visible").GetBoolean());
        
        // phone should be added
        Assert.False(fieldConfig.GetProperty("phone").GetProperty("visible").GetBoolean());
    }

    [Fact]
    public void Build_WithPartialFieldConfigInput_OnlyWritesProvidedFields()
    {
        // Arrange - only visible is provided for phone, required is null
        var fieldConfig = new Dictionary<string, FieldConfigInput>
        {
            ["phone"] = new FieldConfigInput(Visible: false, Required: null, VisibleToEmployee: null, VisibleToManager: null)
        };

        // Act
        var result = TenantSettingsOverrideBuilder.Build(null, null, fieldConfig, null);

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var phone = json.RootElement.GetProperty("employeeFieldConfig").GetProperty("phone");
        
        // visible should be present
        Assert.False(phone.GetProperty("visible").GetBoolean());
        
        // required should NOT be present (null input)
        Assert.False(phone.TryGetProperty("required", out _));
    }

    [Fact]
    public void Build_WithBrandingLogoUrl_SetsLogoUrl()
    {
        // Act
        var result = TenantSettingsOverrideBuilder.Build(
            null,
            null,
            null,
            new BrandingSettingsInput("https://example.com/logo.png", null));

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var branding = json.RootElement.GetProperty("branding");
        Assert.Equal("https://example.com/logo.png", branding.GetProperty("logoUrl").GetString());
    }

    [Fact]
    public void Build_WithEmptyBrandingInput_ReturnsNull()
    {
        // Act - branding with both nulls should not persist an empty branding object
        var result = TenantSettingsOverrideBuilder.Build(
            null,
            null,
            null,
            new BrandingSettingsInput(null, null));

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void Build_WithEmptyFieldConfigInput_ReturnsNull()
    {
        // Act - field config with no actual values should not persist
        var result = TenantSettingsOverrideBuilder.Build(
            null,
            null,
            new Dictionary<string, FieldConfigInput>
            {
                ["phone"] = new FieldConfigInput(null, null, null, null) // All null
            },
            null);

        // Assert
        Assert.Null(result);
    }

    #region Per-Role Visibility Tests

    [Fact]
    public void Build_WithVisibleToEmployee_WritesToJson()
    {
        // Act
        var result = TenantSettingsOverrideBuilder.Build(
            null,
            null,
            new Dictionary<string, FieldConfigInput>
            {
                ["phone"] = new FieldConfigInput(null, null, VisibleToEmployee: false, VisibleToManager: null)
            },
            null);

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var phone = json.RootElement.GetProperty("employeeFieldConfig").GetProperty("phone");
        Assert.False(phone.GetProperty("visibleToEmployee").GetBoolean());
        Assert.False(phone.TryGetProperty("visibleToManager", out _));
    }

    [Fact]
    public void Build_WithVisibleToManager_WritesToJson()
    {
        // Act
        var result = TenantSettingsOverrideBuilder.Build(
            null,
            null,
            new Dictionary<string, FieldConfigInput>
            {
                ["jobTitle"] = new FieldConfigInput(null, null, VisibleToEmployee: null, VisibleToManager: false)
            },
            null);

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var jobTitle = json.RootElement.GetProperty("employeeFieldConfig").GetProperty("jobTitle");
        Assert.False(jobTitle.GetProperty("visibleToManager").GetBoolean());
        Assert.False(jobTitle.TryGetProperty("visibleToEmployee", out _));
    }

    [Fact]
    public void Build_WithBothRoleVisibilityFields_WritesBoth()
    {
        // Act
        var result = TenantSettingsOverrideBuilder.Build(
            null,
            null,
            new Dictionary<string, FieldConfigInput>
            {
                ["hireDate"] = new FieldConfigInput(null, null, VisibleToEmployee: false, VisibleToManager: true)
            },
            null);

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var hireDate = json.RootElement.GetProperty("employeeFieldConfig").GetProperty("hireDate");
        Assert.False(hireDate.GetProperty("visibleToEmployee").GetBoolean());
        Assert.True(hireDate.GetProperty("visibleToManager").GetBoolean());
    }

    [Fact]
    public void Build_WithAllFourFieldConfigProperties_WritesAll()
    {
        // Act
        var result = TenantSettingsOverrideBuilder.Build(
            null,
            null,
            new Dictionary<string, FieldConfigInput>
            {
                ["phone"] = new FieldConfigInput(
                    Visible: false,
                    Required: true,
                    VisibleToEmployee: false,
                    VisibleToManager: true)
            },
            null);

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var phone = json.RootElement.GetProperty("employeeFieldConfig").GetProperty("phone");
        Assert.False(phone.GetProperty("visible").GetBoolean());
        Assert.True(phone.GetProperty("required").GetBoolean());
        Assert.False(phone.GetProperty("visibleToEmployee").GetBoolean());
        Assert.True(phone.GetProperty("visibleToManager").GetBoolean());
    }

    [Fact]
    public void Build_MergesRoleVisibilityWithExisting()
    {
        // Arrange - existing has visible set
        var existing = """{"employeeFieldConfig":{"phone":{"visible":false}}}""";

        // Act - add role visibility
        var result = TenantSettingsOverrideBuilder.Build(
            existing,
            null,
            new Dictionary<string, FieldConfigInput>
            {
                ["phone"] = new FieldConfigInput(null, null, VisibleToEmployee: false, VisibleToManager: null)
            },
            null);

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var phone = json.RootElement.GetProperty("employeeFieldConfig").GetProperty("phone");
        Assert.False(phone.GetProperty("visible").GetBoolean()); // Preserved
        Assert.False(phone.GetProperty("visibleToEmployee").GetBoolean()); // Added
    }

    [Fact]
    public void Build_WithOnlyRoleVisibility_CreatesValidJson()
    {
        // Act - only role visibility, no visible/required
        var result = TenantSettingsOverrideBuilder.Build(
            null,
            null,
            new Dictionary<string, FieldConfigInput>
            {
                ["jobTitle"] = new FieldConfigInput(null, null, VisibleToEmployee: true, VisibleToManager: false)
            },
            null);

        // Assert
        Assert.NotNull(result);
        var json = JsonDocument.Parse(result);
        var jobTitle = json.RootElement.GetProperty("employeeFieldConfig").GetProperty("jobTitle");
        Assert.True(jobTitle.GetProperty("visibleToEmployee").GetBoolean());
        Assert.False(jobTitle.GetProperty("visibleToManager").GetBoolean());
        Assert.False(jobTitle.TryGetProperty("visible", out _));
        Assert.False(jobTitle.TryGetProperty("required", out _));
    }

    #endregion
}

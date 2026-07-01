using CoreHREntities = EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Commands.UpdateTenantSettings;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Features.TenantSettings;

public class UpdateTenantSettingsCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    private static void AddActivatedSetupState(DbContext context)
    {
        context.Set<CoreHREntities.TenantSetupState>()
            .Add(CoreHREntities.TenantSetupState.CreateActivated(TenantId));
    }

    #region Create (No Existing Settings)

    [Fact]
    public async Task Handle_WithNoExistingSettings_CreatesNewSettings()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        AddActivatedSetupState(context);
        await context.SaveChangesAsync();
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: ["Division", "Team"],
            EmployeeFieldConfig: null,
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(["Division", "Team"], result.Value.OrgUnitTypes);
        Assert.NotNull(result.Value.Version);

        // Verify persisted
        var saved = await context.TenantSettings.IgnoreQueryFilters().FirstOrDefaultAsync();
        Assert.NotNull(saved);
        Assert.Equal(TenantId, saved.TenantId);
    }

    [Fact]
    public async Task Handle_WithNoExistingAndNullRequest_ReturnsDefaultsWithVersion()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: null,
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(TenantSettingsDto.Defaults.OrgUnitTypes, result.Value.OrgUnitTypes);
        Assert.NotNull(result.Value.Version);
    }

    #endregion

    #region Update (Existing Settings)

    [Fact]
    public async Task Handle_WithExistingSettings_UpdatesSettings()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        // Seed existing settings
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        AddActivatedSetupState(seedContext);
        var existingSettings = CoreHREntities.TenantSettings.Create(TenantId, """{"orgUnitTypes":["Old"]}""");
        seedContext.TenantSettings.Add(existingSettings);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: ["New1", "New2"],
            EmployeeFieldConfig: null,
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(["New1", "New2"], result.Value.OrgUnitTypes);
    }

    [Fact]
    public async Task Handle_WithWrongVersion_ThrowsConcurrencyException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        // Seed existing settings
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        AddActivatedSetupState(seedContext);
        var existingSettings = CoreHREntities.TenantSettings.Create(TenantId);
        seedContext.TenantSettings.Add(existingSettings);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: 999, // Wrong version
            OrgUnitTypes: ["New"],
            EmployeeFieldConfig: null,
            Branding: null);

        // Act & Assert
        await Assert.ThrowsAsync<ConcurrencyException>(
            () => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_WithMissingVersionOnExistingSettings_ThrowsConcurrencyException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        // Seed existing settings
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        AddActivatedSetupState(seedContext);
        var existingSettings = CoreHREntities.TenantSettings.Create(TenantId);
        seedContext.TenantSettings.Add(existingSettings);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null, // Missing If-Match
            OrgUnitTypes: ["New"],
            EmployeeFieldConfig: null,
            Branding: null);

        // Act & Assert
        await Assert.ThrowsAsync<ConcurrencyException>(
            () => handler.Handle(command, CancellationToken.None));
    }

    #endregion

    #region Partial Updates

    [Fact]
    public async Task Handle_WithPartialOrgUnitTypes_OnlyUpdatesOrgUnitTypes()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        // Seed with branding already set
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        AddActivatedSetupState(seedContext);
        var existingSettings = CoreHREntities.TenantSettings.Create(
            TenantId,
            """{"branding":{"primaryColor":"#ff0000"}}""");
        seedContext.TenantSettings.Add(existingSettings);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: ["Updated"],
            EmployeeFieldConfig: null,
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(["Updated"], result.Value.OrgUnitTypes);
        Assert.Equal("#ff0000", result.Value.Branding.PrimaryColor); // Preserved
    }

    [Fact]
    public async Task Handle_WithPartialBranding_OnlyUpdatesBranding()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        // Seed with org unit types already set
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var existingSettings = CoreHREntities.TenantSettings.Create(
            TenantId,
            """{"orgUnitTypes":["Existing"]}""");
        seedContext.TenantSettings.Add(existingSettings);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: null,
            EmployeeFieldConfig: null,
            Branding: new BrandingSettingsInput(null, "#00ff00"));

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(["Existing"], result.Value.OrgUnitTypes); // Preserved
        Assert.Equal("#00ff00", result.Value.Branding.PrimaryColor);
    }

    [Fact]
    public async Task Handle_WithPartialFieldConfig_MergesFieldConfig()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        // Seed with firstName config
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var existingSettings = CoreHREntities.TenantSettings.Create(
            TenantId,
            """{"employeeFieldConfig":{"firstName":{"visible":false,"required":false}}}""");
        seedContext.TenantSettings.Add(existingSettings);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                ["phone"] = new FieldConfigInput(false, true, null, null)
            },
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.False(result.Value.EmployeeFieldConfig["firstName"].Visible); // Preserved from override
        Assert.False(result.Value.EmployeeFieldConfig["phone"].Visible); // New
        Assert.True(result.Value.EmployeeFieldConfig["phone"].Required); // New
    }

    #endregion

    #region Validation

    [Fact]
    public async Task Handle_WithEmptyOrgUnitTypes_ThrowsArgumentException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: [], // Empty
            EmployeeFieldConfig: null,
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("empty", ex.Message);
    }

    [Fact]
    public async Task Handle_WithDuplicateOrgUnitTypes_ThrowsArgumentException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: ["Team", "team"], // Duplicate (case-insensitive)
            EmployeeFieldConfig: null,
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("duplicate", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Handle_WithUnknownFieldName_ThrowsArgumentException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                ["unknownField"] = new FieldConfigInput(true, false, null, null)
            },
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("unknownField", ex.Message);
    }

    [Fact]
    public async Task Handle_WithInvalidHexColor_ThrowsArgumentException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: null,
            Branding: new BrandingSettingsInput(null, "not-a-color"));

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("hex color", ex.Message);
    }

    [Fact]
    public async Task Handle_WithInvalidLogoUrl_ThrowsArgumentException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: null,
            Branding: new BrandingSettingsInput("not-a-url", null));

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("URL", ex.Message);
    }

    #endregion

    #region DraftStructureSchema Updates

    [Fact]
    public async Task Handle_WithDraftStructureSchema_UpdatesKindsAndPreservesAttributes()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        AddActivatedSetupState(seedContext);
        var existingSettings = CoreHREntities.TenantSettings.Create(
            TenantId,
            """
            {
                "draftStructureSchema": {
                    "orgUnitKinds": [
                        { "key": "department", "displayLabel": "Department" },
                        { "key": "team", "displayLabel": "Team" }
                    ],
                    "attributes": [
                        {
                            "key": "costCenter",
                            "displayLabel": "Cost Center",
                            "valueType": "text",
                            "required": false,
                            "appliesToKindKeys": ["department"]
                        }
                    ]
                }
            }
            """);
        seedContext.TenantSettings.Add(existingSettings);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: null,
            DraftStructureSchema: new DraftStructureSchemaDto
            {
                OrgUnitKinds =
                [
                    new OrgUnitKindDto("department", "Division"),
                    new OrgUnitKindDto("team", "Team")
                ],
                Attributes =
                [
                    new DraftStructureAttributeDefinitionDto(
                        "costCenter",
                        "Cost Center",
                        "text",
                        false,
                        ["department"])
                ]
            },
            EmployeeFieldConfig: null,
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(["Division", "Team"], result.Value.OrgUnitTypes);
        Assert.Equal("Division", result.Value.DraftStructureSchema.OrgUnitKinds[0].DisplayLabel);
        Assert.Single(result.Value.DraftStructureSchema.Attributes);
    }

    [Fact]
    public async Task Handle_RemovingDraftOrgUnitKindInUse_ThrowsArgumentException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        AddActivatedSetupState(seedContext);
        var existingSettings = CoreHREntities.TenantSettings.Create(
            TenantId,
            """
            {
                "draftStructureSchema": {
                    "orgUnitKinds": [
                        { "key": "department", "displayLabel": "Department" },
                        { "key": "team", "displayLabel": "Team" }
                    ],
                    "attributes": []
                }
            }
            """);
        seedContext.TenantSettings.Add(existingSettings);
        seedContext.DraftOrgUnits.Add(
            CoreHREntities.DraftOrgUnit.Create(
                TenantId,
                "ENG-T1",
                "Team 1",
                "team",
                null,
                null,
                null,
                null));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: null,
            DraftStructureSchema: new DraftStructureSchemaDto
            {
                OrgUnitKinds = [new OrgUnitKindDto("department", "Department")],
                Attributes = []
            },
            EmployeeFieldConfig: null,
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("team", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("draft org units", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Handle_CreatingSettingsThatRemoveDefaultDraftKindInUse_ThrowsArgumentException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        AddActivatedSetupState(seedContext);
        seedContext.DraftOrgUnits.Add(
            CoreHREntities.DraftOrgUnit.Create(
                TenantId,
                "TEAM-1",
                "Team 1",
                "team",
                null,
                null,
                null,
                null));
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            DraftStructureSchema: new DraftStructureSchemaDto
            {
                OrgUnitKinds = [new OrgUnitKindDto("department", "Department")],
                Attributes = []
            },
            EmployeeFieldConfig: null,
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("draft org unit kind", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Handle_WithApprovedSetupAndDraftStructureSchema_UpdatesSettings()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var state = CoreHREntities.TenantSetupState.CreateActivated(TenantId);
        state.Approve(Guid.NewGuid(), "Jordan Approver", "HRAdmin", false);

        var existingSettings = CoreHREntities.TenantSettings.Create(
            TenantId,
            """
            {
                "draftStructureSchema": {
                    "orgUnitKinds": [
                        { "key": "department", "displayLabel": "Department" }
                    ],
                    "attributes": []
                }
            }
            """);

        seedContext.TenantSetupStates.Add(state);
        seedContext.TenantSettings.Add(existingSettings);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: null,
            DraftStructureSchema: new DraftStructureSchemaDto
            {
                OrgUnitKinds = [new OrgUnitKindDto("department", "Division")],
                Attributes = []
            },
            EmployeeFieldConfig: null,
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(["Division"], result.Value.OrgUnitTypes);
        Assert.Single(result.Value.DraftStructureSchema.OrgUnitKinds);
        Assert.Equal("Division", result.Value.DraftStructureSchema.OrgUnitKinds[0].DisplayLabel);
    }

    #endregion

    #region Core Field Validation (Per-Role Visibility)

    [Fact]
    public async Task Handle_WithCoreFieldVisibleFalse_ThrowsArgumentException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                ["firstName"] = new FieldConfigInput(Visible: false, Required: null, VisibleToEmployee: null, VisibleToManager: null)
            },
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("firstName", ex.Message);
        Assert.Contains("core field", ex.Message);
        Assert.Contains("hidden", ex.Message);
    }

    [Fact]
    public async Task Handle_WithCoreFieldRequiredFalse_ThrowsArgumentException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                ["email"] = new FieldConfigInput(Visible: null, Required: false, VisibleToEmployee: null, VisibleToManager: null)
            },
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("email", ex.Message);
        Assert.Contains("core field", ex.Message);
        Assert.Contains("optional", ex.Message);
    }

    [Fact]
    public async Task Handle_WithHireDateRequiredFalse_ThrowsArgumentException()
    {
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                ["hireDate"] = new FieldConfigInput(Visible: null, Required: false, VisibleToEmployee: null, VisibleToManager: null)
            },
            Branding: null);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));

        Assert.Contains("hireDate", ex.Message);
        Assert.Contains("optional", ex.Message);
    }

    [Fact]
    public async Task Handle_WithCoreFieldVisibleToEmployeeFalse_ThrowsArgumentException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                ["lastName"] = new FieldConfigInput(Visible: null, Required: null, VisibleToEmployee: false, VisibleToManager: null)
            },
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("lastName", ex.Message);
        Assert.Contains("core field", ex.Message);
        Assert.Contains("employees", ex.Message);
    }

    [Fact]
    public async Task Handle_WithCoreFieldVisibleToManagerFalse_ThrowsArgumentException()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                ["firstName"] = new FieldConfigInput(Visible: null, Required: null, VisibleToEmployee: null, VisibleToManager: false)
            },
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("firstName", ex.Message);
        Assert.Contains("core field", ex.Message);
        Assert.Contains("managers", ex.Message);
    }

    [Fact]
    public async Task Handle_WithNonCoreFieldVisibleToEmployeeFalse_Succeeds()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                ["phone"] = new FieldConfigInput(Visible: null, Required: null, VisibleToEmployee: false, VisibleToManager: null)
            },
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.False(result.Value.EmployeeFieldConfig["phone"].VisibleToEmployee);
    }

    [Fact]
    public async Task Handle_WithNonCoreFieldVisibleToManagerFalse_Succeeds()
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                ["jobTitle"] = new FieldConfigInput(Visible: null, Required: null, VisibleToEmployee: null, VisibleToManager: false)
            },
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.False(result.Value.EmployeeFieldConfig["jobTitle"].VisibleToManager);
    }

    [Fact]
    public async Task Handle_WithCoreFieldRoleVisibilityTrue_Succeeds()
    {
        // Arrange - setting true should always be allowed
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                ["firstName"] = new FieldConfigInput(Visible: true, Required: true, VisibleToEmployee: true, VisibleToManager: true)
            },
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.True(result.Value.EmployeeFieldConfig["firstName"].VisibleToEmployee);
        Assert.True(result.Value.EmployeeFieldConfig["firstName"].VisibleToManager);
    }

    [Theory]
    [InlineData("firstName")]
    [InlineData("lastName")]
    [InlineData("email")]
    public async Task Handle_WithAnyCoreFieldHiddenFromEmployee_ThrowsArgumentException(string coreField)
    {
        // Arrange
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                [coreField] = new FieldConfigInput(null, null, VisibleToEmployee: false, VisibleToManager: null)
            },
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains(coreField, ex.Message);
    }

    [Fact]
    public async Task Handle_WithPartialRoleVisibilityUpdate_MergesCorrectly()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        // Seed existing settings with visible override
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var existingSettings = CoreHREntities.TenantSettings.Create(
            TenantId,
            """{"employeeFieldConfig":{"phone":{"visible":false}}}""");
        seedContext.TenantSettings.Add(existingSettings);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        // Update only role visibility
        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: null,
            EmployeeFieldConfig: new Dictionary<string, FieldConfigInput>
            {
                ["phone"] = new FieldConfigInput(null, null, VisibleToEmployee: false, VisibleToManager: null)
            },
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.False(result.Value.EmployeeFieldConfig["phone"].Visible); // Preserved from existing
        Assert.False(result.Value.EmployeeFieldConfig["phone"].VisibleToEmployee); // New
        Assert.True(result.Value.EmployeeFieldConfig["phone"].VisibleToManager); // Default
    }

    #endregion

    #region OrgUnitType Removal Guard

    [Fact]
    public async Task Handle_RemovingUnusedOrgUnitType_Succeeds()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        AddActivatedSetupState(seedContext);
        // Settings with Department and Team types
        var existingSettings = CoreHREntities.TenantSettings.Create(
            TenantId,
            """{"orgUnitTypes":["Department","Team"]}""");
        seedContext.TenantSettings.Add(existingSettings);
        
        // Only a Department OrgUnit exists - Team is unused
        var orgUnit = CoreHREntities.OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        seedContext.OrgUnits.Add(orgUnit);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        // Remove Team type (unused)
        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: ["Department"], // Removing Team
            EmployeeFieldConfig: null,
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.OrgUnitTypes);
        Assert.Equal("Department", result.Value.OrgUnitTypes[0]);
    }

    [Fact]
    public async Task Handle_RemovingOrgUnitTypeInUse_ThrowsArgumentException()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        AddActivatedSetupState(seedContext);
        // Settings with Department and Team types
        var existingSettings = CoreHREntities.TenantSettings.Create(
            TenantId,
            """{"orgUnitTypes":["Department","Team"]}""");
        seedContext.TenantSettings.Add(existingSettings);
        
        // Both types are in use
        var dept = CoreHREntities.OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        var team = CoreHREntities.OrgUnit.Create(TenantId, "ENG-T1", "Team 1", "Team", null);
        seedContext.OrgUnits.AddRange(dept, team);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        // Try to remove Team type (in use)
        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: ["Department"], // Trying to remove Team
            EmployeeFieldConfig: null,
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("Team", ex.Message);
        Assert.Contains("in use", ex.Message);
    }

    [Fact]
    public async Task Handle_RemovingOrgUnitTypeInUse_CaseInsensitive()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        AddActivatedSetupState(seedContext);
        var existingSettings = CoreHREntities.TenantSettings.Create(
            TenantId,
            """{"orgUnitTypes":["department","TEAM"]}""");
        seedContext.TenantSettings.Add(existingSettings);
        
        // OrgUnit with "Department" (different case than settings)
        var dept = CoreHREntities.OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
        seedContext.OrgUnits.Add(dept);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        // Try to remove "department" (lowercase in settings, but OrgUnit uses "Department")
        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: ["TEAM"], // Trying to remove department
            EmployeeFieldConfig: null,
            Branding: null);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
        Assert.Contains("department", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Handle_RemovingOrgUnitTypeOnlyOnInactiveUnits_Succeeds()
    {
        // Arrange
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        AddActivatedSetupState(seedContext);
        var existingSettings = CoreHREntities.TenantSettings.Create(
            TenantId,
            """{"orgUnitTypes":["Department","Team"]}""");
        seedContext.TenantSettings.Add(existingSettings);
        
        // Team OrgUnit exists but is inactive
        var team = CoreHREntities.OrgUnit.Create(TenantId, "ENG-T1", "Team 1", "Team", null);
        team.Deactivate();
        seedContext.OrgUnits.Add(team);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        // Remove Team type - should succeed because only inactive OrgUnits use it
        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: existingSettings.Version,
            OrgUnitTypes: ["Department"],
            EmployeeFieldConfig: null,
            Branding: null);

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
    }

    #endregion

    #region Provisioning

    [Fact]
    public async Task Handle_WithProvisioningSettings_PersistsProvisioningPolicy()
    {
        var profileId = Guid.NewGuid();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: null,
            Branding: null,
            Provisioning: new ProvisioningSettingsInput(
                profileId,
                InviteExpiryDays: 30,
                ResendCooldownHours: 6,
                PendingInviteBehavior: "KeepExisting"));

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(profileId, result.Value.Provisioning.DefaultAccessProfileId);
        Assert.Equal(30, result.Value.Provisioning.InviteExpiryDays);
        Assert.Equal(6, result.Value.Provisioning.ResendCooldownHours);
        Assert.Equal("KeepExisting", result.Value.Provisioning.PendingInviteBehavior);
    }

    [Theory]
    [InlineData(0, 24, "RefreshExisting")]
    [InlineData(91, 24, "RefreshExisting")]
    [InlineData(14, -1, "RefreshExisting")]
    [InlineData(14, 721, "RefreshExisting")]
    [InlineData(14, 24, "ReplaceExisting")]
    public async Task Handle_WithInvalidProvisioningSettings_ThrowsArgumentException(
        int inviteExpiryDays,
        int resendCooldownHours,
        string pendingInviteBehavior)
    {
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = new UpdateTenantSettingsCommandHandler(context, tenantContext);

        var command = new UpdateTenantSettingsCommand(
            ExpectedVersion: null,
            OrgUnitTypes: null,
            EmployeeFieldConfig: null,
            Branding: null,
            Provisioning: new ProvisioningSettingsInput(
                Guid.NewGuid(),
                inviteExpiryDays,
                resendCooldownHours,
                pendingInviteBehavior));

        await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(command, CancellationToken.None));
    }

    #endregion
}

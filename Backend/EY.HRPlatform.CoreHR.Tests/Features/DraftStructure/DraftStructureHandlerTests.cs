using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.CreateDraftOrgUnit;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.DeleteDraftOrgUnit;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.UpdateDraftOrgUnit;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftOrgUnitById;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftOrgUnitTree;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftStructureWorkspace;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using DomainTenantSettings = EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings;

namespace EY.HRPlatform.CoreHR.Tests.Features.DraftStructure;

public class DraftStructureHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private const string SettingsJson = """{"orgUnitTypes":["Department","Team","Squad"]}""";

    [Fact]
    public async Task CreateDraftOrgUnit_WithValidData_ReturnsCreatedDraftOrgUnit()
    {
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        await SeedSlicePrerequisitesAsync(context, TenantId);

        var handler = new CreateDraftOrgUnitCommandHandler(context, tenantContext);
        var command = new CreateDraftOrgUnitCommand("ENG", "Engineering", "Department", null);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("ENG", result.Value.Code);
        Assert.Equal("Engineering", result.Value.Name);
        Assert.Equal("Department", result.Value.Type);
        Assert.Null(result.Value.ParentId);

        var saved = await context.DraftOrgUnits.IgnoreQueryFilters().FirstOrDefaultAsync();
        Assert.NotNull(saved);
        Assert.Equal(result.Value.Id, saved.Id);
    }

    [Fact]
    public async Task CreateDraftOrgUnit_WithSameCodeAsLiveOrgUnit_Succeeds()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));
            seedContext.OrgUnits.Add(OrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new CreateDraftOrgUnitCommandHandler(context, tenantContext);

        var result = await handler.Handle(
            new CreateDraftOrgUnitCommand("ENG", "Engineering Draft", "Department", null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("ENG", result.Value.Code);
        Assert.Equal("Engineering Draft", result.Value.Name);
    }

    [Fact]
    public async Task CreateDraftOrgUnit_WithInvalidType_ThrowsArgumentException()
    {
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        await SeedSlicePrerequisitesAsync(context, TenantId);

        var handler = new CreateDraftOrgUnitCommandHandler(context, tenantContext);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(
                new CreateDraftOrgUnitCommand("OPS", "Operations", "Division", null),
                CancellationToken.None));

        Assert.Contains("Invalid org unit type", ex.Message);
    }

    [Fact]
    public async Task UpdateDraftOrgUnit_WithCodeChange_PersistsUpdatedCode()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        DraftOrgUnit draftOrgUnit;
        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));
            draftOrgUnit = DraftOrgUnit.Create(TenantId, "eng", "Engineering", "Department", null);
            seedContext.DraftOrgUnits.Add(draftOrgUnit);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var existing = await context.DraftOrgUnits.FirstAsync();
        var handler = new UpdateDraftOrgUnitCommandHandler(context);

        var result = await handler.Handle(
            new UpdateDraftOrgUnitCommand(
                existing.Id,
                "eng-core",
                "Engineering Core",
                "Department",
                null,
                existing.Version),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("ENG-CORE", result.Value.Code);
        Assert.Equal("Engineering Core", result.Value.Name);
    }

    [Fact]
    public async Task UpdateDraftOrgUnit_WithCycle_ThrowsArgumentException()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var root = DraftOrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
            seedContext.DraftOrgUnits.Add(root);
            await seedContext.SaveChangesAsync();

            var child = DraftOrgUnit.Create(TenantId, "TEAM", "Platform Team", "Team", root.Id);
            seedContext.DraftOrgUnits.Add(child);
            await seedContext.SaveChangesAsync();

            var grandChild = DraftOrgUnit.Create(TenantId, "SQUAD", "API Squad", "Squad", child.Id);
            seedContext.DraftOrgUnits.Add(grandChild);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var rootUnit = await context.DraftOrgUnits.FirstAsync(o => o.Code == "ENG");
        var grandChildUnit = await context.DraftOrgUnits.FirstAsync(o => o.Code == "SQUAD");
        var handler = new UpdateDraftOrgUnitCommandHandler(context);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(
                new UpdateDraftOrgUnitCommand(
                    rootUnit.Id,
                    rootUnit.Code,
                    rootUnit.Name,
                    rootUnit.Type,
                    grandChildUnit.Id,
                    rootUnit.Version),
                CancellationToken.None));

        Assert.Contains("cycle", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DeleteDraftOrgUnit_WithReplacementParent_ReparentsChildren()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        Guid deleteId;
        Guid childId;
        Guid replacementId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var department = DraftOrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
            var archive = DraftOrgUnit.Create(TenantId, "OPS", "Operations", "Department", null);
            seedContext.DraftOrgUnits.AddRange(department, archive);
            await seedContext.SaveChangesAsync();

            var child = DraftOrgUnit.Create(TenantId, "TEAM", "Platform Team", "Team", department.Id);
            seedContext.DraftOrgUnits.Add(child);
            await seedContext.SaveChangesAsync();

            deleteId = department.Id;
            childId = child.Id;
            replacementId = archive.Id;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var draftToDelete = await context.DraftOrgUnits.FirstAsync(o => o.Id == deleteId);
        var handler = new DeleteDraftOrgUnitCommandHandler(context);

        var result = await handler.Handle(
            new DeleteDraftOrgUnitCommand(deleteId, draftToDelete.Version, replacementId, false),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(await context.DraftOrgUnits.FirstOrDefaultAsync(o => o.Id == deleteId));

        var reparentedChild = await context.DraftOrgUnits.FirstAsync(o => o.Id == childId);
        Assert.Equal(replacementId, reparentedChild.ParentId);
    }

    [Fact]
    public async Task DeleteDraftOrgUnit_WithPromoteChildrenToRoot_ReparentsChildrenToRoot()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        Guid deleteId;
        Guid childId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var department = DraftOrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
            seedContext.DraftOrgUnits.Add(department);
            await seedContext.SaveChangesAsync();

            var child = DraftOrgUnit.Create(TenantId, "TEAM", "Platform Team", "Team", department.Id);
            seedContext.DraftOrgUnits.Add(child);
            await seedContext.SaveChangesAsync();

            deleteId = department.Id;
            childId = child.Id;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var draftToDelete = await context.DraftOrgUnits.FirstAsync(o => o.Id == deleteId);
        var handler = new DeleteDraftOrgUnitCommandHandler(context);

        var result = await handler.Handle(
            new DeleteDraftOrgUnitCommand(deleteId, draftToDelete.Version, null, true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);

        var promotedChild = await context.DraftOrgUnits.FirstAsync(o => o.Id == childId);
        Assert.Null(promotedChild.ParentId);
    }

    [Fact]
    public async Task DeleteDraftOrgUnit_WithChildrenWithoutStrategy_ThrowsArgumentException()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        Guid deleteId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var department = DraftOrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
            seedContext.DraftOrgUnits.Add(department);
            await seedContext.SaveChangesAsync();

            seedContext.DraftOrgUnits.Add(DraftOrgUnit.Create(TenantId, "TEAM", "Platform Team", "Team", department.Id));
            await seedContext.SaveChangesAsync();

            deleteId = department.Id;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var draftToDelete = await context.DraftOrgUnits.FirstAsync(o => o.Id == deleteId);
        var handler = new DeleteDraftOrgUnitCommandHandler(context);

        var ex = await Assert.ThrowsAsync<ArgumentException>(
            () => handler.Handle(
                new DeleteDraftOrgUnitCommand(deleteId, draftToDelete.Version, null, false),
                CancellationToken.None));

        Assert.Contains("replacement parent", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetDraftStructureWorkspace_ReturnsWorkspaceCountsAndAllowedTypes()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var department = DraftOrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
            seedContext.DraftOrgUnits.Add(department);
            await seedContext.SaveChangesAsync();

            seedContext.DraftOrgUnits.Add(DraftOrgUnit.Create(TenantId, "TEAM", "Platform Team", "Team", department.Id));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetDraftStructureWorkspaceQueryHandler(context);

        var result = await handler.Handle(new GetDraftStructureWorkspaceQuery(), CancellationToken.None);

        Assert.Equal("inProgress", result.WorkspaceStatus);
        Assert.Equal(2, result.UnitCount);
        Assert.Equal(1, result.RootUnitCount);
        Assert.Contains("Department", result.AllowedTypes);
        Assert.NotNull(result.LastModifiedAt);
    }

    [Fact]
    public async Task GetDraftOrgUnitTree_ReturnsHierarchy()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
            seedContext.TenantSettings.Add(DomainTenantSettings.Create(TenantId, SettingsJson));

            var root = DraftOrgUnit.Create(TenantId, "ENG", "Engineering", "Department", null);
            seedContext.DraftOrgUnits.Add(root);
            await seedContext.SaveChangesAsync();

            seedContext.DraftOrgUnits.Add(DraftOrgUnit.Create(TenantId, "TEAM", "Platform Team", "Team", root.Id));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetDraftOrgUnitTreeQueryHandler(context);

        var tree = await handler.Handle(new GetDraftOrgUnitTreeQuery(null), CancellationToken.None);

        Assert.Single(tree);
        Assert.Equal("Engineering", tree[0].Name);
        Assert.Single(tree[0].Children);
        Assert.Equal("Platform Team", tree[0].Children[0].Name);
    }

    [Fact]
    public async Task DraftStructureQueries_RespectTenantIsolation()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.AddRange(
                TenantSetupState.CreateActivated(tenantA),
                TenantSetupState.CreateActivated(tenantB));
            seedContext.TenantSettings.AddRange(
                DomainTenantSettings.Create(tenantA, SettingsJson),
                DomainTenantSettings.Create(tenantB, SettingsJson));
            seedContext.DraftOrgUnits.Add(DraftOrgUnit.Create(tenantA, "ENG", "Engineering", "Department", null));
            await seedContext.SaveChangesAsync();
        }

        var tenantContext = TestTenantContext.WithTenant(tenantB);
        await using var context = TestDbContextFactory.Create(tenantContext, dbName);

        var workspaceHandler = new GetDraftStructureWorkspaceQueryHandler(context);
        var workspace = await workspaceHandler.Handle(new GetDraftStructureWorkspaceQuery(), CancellationToken.None);

        Assert.Equal("empty", workspace.WorkspaceStatus);
        Assert.Empty(workspace.Units);
    }

    [Fact]
    public async Task GetDraftOrgUnitById_FromDifferentTenant_ThrowsEntityNotFoundException()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        Guid draftId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            seedContext.TenantSetupStates.AddRange(
                TenantSetupState.CreateActivated(tenantA),
                TenantSetupState.CreateActivated(tenantB));
            seedContext.TenantSettings.AddRange(
                DomainTenantSettings.Create(tenantA, SettingsJson),
                DomainTenantSettings.Create(tenantB, SettingsJson));

            var draft = DraftOrgUnit.Create(tenantA, "ENG", "Engineering", "Department", null);
            seedContext.DraftOrgUnits.Add(draft);
            await seedContext.SaveChangesAsync();
            draftId = draft.Id;
        }

        var tenantContext = TestTenantContext.WithTenant(tenantB);
        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetDraftOrgUnitByIdQueryHandler(context);

        await Assert.ThrowsAsync<EntityNotFoundException>(
            () => handler.Handle(new GetDraftOrgUnitByIdQuery(draftId), CancellationToken.None));
    }

    private static async Task SeedSlicePrerequisitesAsync(CoreHRDbContext context, Guid tenantId)
    {
        context.TenantSetupStates.Add(TenantSetupState.CreateActivated(tenantId));
        context.TenantSettings.Add(DomainTenantSettings.Create(tenantId, SettingsJson));
        await context.SaveChangesAsync();
    }
}
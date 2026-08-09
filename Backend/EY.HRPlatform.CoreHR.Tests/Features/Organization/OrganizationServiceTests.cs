using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Tests.Features.Organization;

public sealed class OrganizationServiceTests
{
    [Fact]
    public async Task Future_root_keeps_current_hierarchy_empty_and_not_ready()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var service = new OrganizationService(db, TestTenantContext.WithTenant(tenantId));
        var tomorrow = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

        await service.CreateRootAsync(new CreateOrganizationRootRequest("ORG", "Fusion", tomorrow), default);

        var current = await service.GetHierarchyAsync(tomorrow.AddDays(-1), default);
        var readiness = await service.GetReadinessAsync(default);

        Assert.Empty(current.Roots);
        Assert.False(readiness.IsReady);
    }

    [Fact]
    public async Task Scheduled_operations_on_the_same_date_remain_individually_cancellable()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var service = new OrganizationService(db, TestTenantContext.WithTenant(tenantId));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var future = today.AddDays(7);
        var root = await service.CreateRootAsync(new CreateOrganizationRootRequest("ORG", "Fusion", today), default);
        var unit = await service.CreateUnitAsync(new CreateOrganizationUnitRequest("TECH", "Technology", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);

        await service.ChangeAsync(unit.Id, unit.Version, new ChangeOrganizationUnitRequest("Engineering", null, future), default);
        var changed = await service.GetUnitAsync(unit.Id, today, default);
        await service.MoveAsync(unit.Id, changed.Version, new MoveOrganizationUnitRequest(root.Id, future), default);
        var upcoming = await service.GetUpcomingChangesAsync(default);

        Assert.Equal(2, upcoming.Count(change => change.OrgUnitId == unit.Id));
        var rename = upcoming.Single(change => change.OrgUnitId == unit.Id && change.Kind == OrganizationChangeKind.Change);
        var latest = await service.GetUnitAsync(unit.Id, today, default);
        await service.CancelChangeAsync(rename.Id, latest.Version, default);

        var remaining = await service.GetUpcomingChangesAsync(default);
        Assert.DoesNotContain(remaining, change => change.Id == rename.Id);
        Assert.Contains(remaining, change => change.OrgUnitId == unit.Id && change.Kind == OrganizationChangeKind.Move);
    }

    [Fact]
    public async Task Custom_type_cannot_reuse_a_built_in_display_name()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var service = new OrganizationService(db, TestTenantContext.WithTenant(tenantId));

        await service.GetTypesAsync(default);

        await Assert.ThrowsAsync<DuplicateEntityException>(() => service.CreateTypeAsync(new CreateOrganizationalUnitTypeRequest("Department"), default));
    }

    [Fact]
    public async Task Inactivation_is_terminal()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var service = new OrganizationService(db, TestTenantContext.WithTenant(tenantId));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var root = await service.CreateRootAsync(new CreateOrganizationRootRequest("ORG", "Fusion", today), default);
        var unit = await service.CreateUnitAsync(new CreateOrganizationUnitRequest("TECH", "Technology", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);
        await service.InactivateAsync(unit.Id, unit.Version, new InactivateOrganizationUnitRequest(today, "Retired"), default);
        var current = await service.GetUnitAsync(unit.Id, today, default);

        await Assert.ThrowsAsync<ArgumentException>(() => service.CorrectAsync(
            unit.Id,
            current.Version,
            new CorrectOrganizationUnitRequest(null, null, null, OrgUnitLifecycleState.Active, today, "Undo retirement"),
            default));
    }

    [Fact]
    public async Task Structural_changes_preserve_existing_work_assignment_org_unit_identity()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var service = new OrganizationService(db, TestTenantContext.WithTenant(tenantId));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var root = await service.CreateRootAsync(new CreateOrganizationRootRequest("ORG", "Fusion", today), default);
        var unit = await service.CreateUnitAsync(new CreateOrganizationUnitRequest("TECH", "Technology", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);
        var assignment = WorkAssignment.Create(tenantId, Guid.NewGuid(), Guid.NewGuid(), unit.Id, "Engineer", null, true,
            DateTime.UtcNow, null, EY.HRPlatform.CoreHR.Domain.Enums.WorkforceSourceType.Manual);
        db.WorkAssignments.Add(assignment);
        await db.SaveChangesAsync();

        await service.ChangeAsync(unit.Id, unit.Version,
            new ChangeOrganizationUnitRequest("Engineering", null, today, "Rename"), default);

        Assert.Equal(unit.Id, (await db.WorkAssignments.SingleAsync()).OrgUnitId);
    }

    [Fact]
    public async Task Names_are_repeatable_but_business_codes_are_not()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var service = new OrganizationService(db, TestTenantContext.WithTenant(tenantId));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var root = await service.CreateRootAsync(new CreateOrganizationRootRequest("ORG", "Fusion", today), default);

        var first = await service.CreateUnitAsync(new CreateOrganizationUnitRequest("OPS-A", "Operations", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);
        var second = await service.CreateUnitAsync(new CreateOrganizationUnitRequest("OPS-B", "Operations", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);

        Assert.NotEqual(first.Id, second.Id);
        await Assert.ThrowsAsync<DuplicateEntityException>(() => service.CreateUnitAsync(
            new CreateOrganizationUnitRequest("OPS-A", "Other", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default));
    }

    [Fact]
    public async Task Correction_cannot_be_scheduled_for_the_future()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var service = new OrganizationService(db, TestTenantContext.WithTenant(tenantId));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var root = await service.CreateRootAsync(new CreateOrganizationRootRequest("ORG", "Fusion", today), default);

        await Assert.ThrowsAsync<ArgumentException>(() => service.CorrectAsync(root.Id, root.Version,
            new CorrectOrganizationUnitRequest("Corrected", null, null, null, today.AddDays(1), "Correction"), default));
    }

    [Fact]
    public async Task Code_correction_reserves_both_the_previous_and_corrected_code_to_the_same_identity()
    {
        var tenantId = Guid.NewGuid();
        await using var db = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantId));
        var service = new OrganizationService(db, TestTenantContext.WithTenant(tenantId));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var root = await service.CreateRootAsync(new CreateOrganizationRootRequest("ORG", "Fusion", today), default);
        var unit = await service.CreateUnitAsync(new CreateOrganizationUnitRequest("TECH", "Technology", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default);

        await service.CorrectCodeAsync(unit.Id, unit.Version, new CorrectOrganizationCodeRequest("ENGINEERING", "Code correction"), default);

        await Assert.ThrowsAsync<DuplicateEntityException>(() => service.CreateUnitAsync(
            new CreateOrganizationUnitRequest("TECH", "Another", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default));
        await Assert.ThrowsAsync<DuplicateEntityException>(() => service.CreateUnitAsync(
            new CreateOrganizationUnitRequest("ENGINEERING", "Another", OrganizationalUnitTypeCatalog.DepartmentId, root.Id, today), default));
    }
}

using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeProfile;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class GetEmployeeProfileQueryHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task GetEmployeeProfile_ActiveEmployeeWithManager_ReturnsProfileWithHierarchyHealthy()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var manager = Employee.Create(TenantId, "Alice", "Manager", "alice.manager@example.com", new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var employee = Employee.Create(TenantId, "Bob", "Worker", "bob.worker@example.com", new DateTime(2021, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        employee.AssignManager(manager.Id);

        // Two active direct reports of employee under test
        var reportOne = Employee.Create(TenantId, "Carol", "One", "carol@example.com", new DateTime(2022, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        reportOne.AssignManager(employee.Id);
        var reportTwo = Employee.Create(TenantId, "Dave", "Two", "dave@example.com", new DateTime(2022, 3, 1, 0, 0, 0, DateTimeKind.Utc));
        reportTwo.AssignManager(employee.Id);

        seedContext.Employees.AddRange(manager, employee, reportOne, reportTwo);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeProfileQuery(employee.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var profile = result.Value;
        Assert.Equal(employee.Id, profile.Id);
        Assert.Equal("Bob", profile.FirstName);
        Assert.Equal("Worker", profile.LastName);
        Assert.Equal("bob.worker@example.com", profile.Email);
        Assert.Equal(manager.Id, profile.ManagerId);
        Assert.Equal("Alice", profile.ManagerFirstName);
        Assert.Equal("Manager", profile.ManagerLastName);
        Assert.Equal(EmployeeHierarchyStatuses.Healthy, profile.HierarchyStatus);
        Assert.Equal(2, profile.DirectReportCount);
    }

    [Fact]
    public async Task GetEmployeeProfile_IsolatedEmployeeWithNoManager_ReturnsNoManagerAssignedStatus()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var employee = Employee.Create(TenantId, "Solo", "Root", "solo.root@example.com", new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeProfileQuery(employee.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value.ManagerId);
        Assert.Null(result.Value.ManagerFullName);
        Assert.Equal(EmployeeHierarchyStatuses.NoManagerAssigned, result.Value.HierarchyStatus);
        Assert.Equal(0, result.Value.DirectReportCount);
    }

    [Fact]
    public async Task GetEmployeeProfile_TopLevelLeaderWithoutManager_ReturnsRootStatus()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var leader = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var directReport = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", new DateTime(2021, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        directReport.AssignManager(leader.Id);

        seedContext.Employees.AddRange(leader, directReport);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeProfileQuery(leader.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value.ManagerId);
        Assert.Equal(EmployeeHierarchyStatuses.Root, result.Value.HierarchyStatus);
        Assert.Equal(1, result.Value.DirectReportCount);
    }

    [Fact]
    public async Task GetEmployeeProfile_EmployeeWithInactiveManager_ReturnsManagerInactiveStatus()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var manager = Employee.Create(TenantId, "Inactive", "Mgr", "inactive.mgr@example.com", new DateTime(2018, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        manager.Deactivate();
        var employee = Employee.Create(TenantId, "Has", "InactiveMgr", "has.inactivemgr@example.com", new DateTime(2021, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        employee.AssignManager(manager.Id);

        seedContext.Employees.AddRange(manager, employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeProfileQuery(employee.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(EmployeeHierarchyStatuses.ManagerInactive, result.Value.HierarchyStatus);
    }

    [Fact]
    public async Task GetEmployeeProfile_DirectReportCountOnlyIncludesActiveReports()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var manager = Employee.Create(TenantId, "Mgr", "Test", "mgr.test@example.com", new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var active = Employee.Create(TenantId, "Active", "Report", "active.report@example.com", new DateTime(2021, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        active.AssignManager(manager.Id);
        var inactive = Employee.Create(TenantId, "Inactive", "Report", "inactive.report@example.com", new DateTime(2021, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        inactive.AssignManager(manager.Id);
        inactive.Deactivate();

        seedContext.Employees.AddRange(manager, active, inactive);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeProfileQuery(manager.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value.DirectReportCount);
    }

    [Fact]
    public async Task GetEmployeeProfile_NotFound_ReturnsFailure()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeProfileQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task GetEmployeeProfile_FromDifferentTenant_ReturnsNotFound()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        Guid employeeId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var employee = Employee.Create(tenantA, "Foreign", "Employee", "foreign@example.com", new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc));
            seedContext.Employees.Add(employee);
            await seedContext.SaveChangesAsync();
            employeeId = employee.Id;
        }

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantB), dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeProfileQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    private static GetEmployeeProfileQueryHandler CreateHandler(CoreHRDbContext context)
        => new(context, new EmployeeReadModelPolicy(), new TenantSettingsReadService(context));
}

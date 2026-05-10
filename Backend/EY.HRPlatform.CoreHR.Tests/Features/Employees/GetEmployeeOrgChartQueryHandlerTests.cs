using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeOrgChart;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class GetEmployeeOrgChartQueryHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task GetEmployeeOrgChart_WithoutRoot_ReturnsForestForVisibleEmployees()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow);
            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow);
            manager.AssignManager(executive.Id);
            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
            report.AssignManager(manager.Id);
            var rootWithoutManager = Employee.Create(TenantId, "Jordan", "Root", "jordan.root@example.com", DateTime.UtcNow);

            seedContext.Employees.AddRange(executive, manager, report, rootWithoutManager);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeOrgChartQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Roots.Count);
        Assert.Equal(4, result.Value.TotalVisibleNodeCount);
        Assert.False(result.Value.IsTruncated);

        var executiveRoot = Assert.Single(result.Value.Roots, root => root.Email == "emma.executive@example.com");
        Assert.False(executiveRoot.IsOrphaned);
        Assert.True(executiveRoot.HasChildren);
        Assert.Equal(1, executiveRoot.DirectReportCount);

        var managerNode = Assert.Single(executiveRoot.Children);
        Assert.Equal("alex.manager@example.com", managerNode.Email);
        Assert.Equal(1, managerNode.Level);
        Assert.True(managerNode.HasChildren);

        var reportNode = Assert.Single(managerNode.Children);
        Assert.Equal("sarah.chen@example.com", reportNode.Email);
        Assert.Equal(2, reportNode.Level);
        Assert.False(reportNode.HasChildren);
    }

    [Fact]
    public async Task GetEmployeeOrgChart_WithRootEmployeeId_ReturnsRequestedSubtree()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        Guid managerId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow);
            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow);
            manager.AssignManager(executive.Id);
            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
            report.AssignManager(manager.Id);

            seedContext.Employees.AddRange(executive, manager, report);
            await seedContext.SaveChangesAsync();
            managerId = manager.Id;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeOrgChartQuery(managerId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var root = Assert.Single(result.Value.Roots);
        Assert.Equal(managerId, root.EmployeeId);
        Assert.Equal(0, root.Level);
        Assert.Single(root.Children);
        Assert.Equal(2, result.Value.TotalVisibleNodeCount);
    }

    [Fact]
    public async Task GetEmployeeOrgChart_WithMaxDepth_TruncatesDescendantsAndMarksTreeTruncated()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow);
            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow);
            manager.AssignManager(executive.Id);
            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
            report.AssignManager(manager.Id);

            seedContext.Employees.AddRange(executive, manager, report);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeOrgChartQuery(MaxDepth: 1), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.IsTruncated);
        Assert.Equal(2, result.Value.TotalVisibleNodeCount);

        var root = Assert.Single(result.Value.Roots);
        var managerNode = Assert.Single(root.Children);
        Assert.True(managerNode.HasChildren);
        Assert.Empty(managerNode.Children);
    }

    [Fact]
    public async Task GetEmployeeOrgChart_WithRootEmployeeIdAndMaxDepth_KeepsSubtreeTruncationState()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        Guid managerId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow);
            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow);
            manager.AssignManager(executive.Id);

            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
            report.AssignManager(manager.Id);

            var deeperReport = Employee.Create(TenantId, "Nina", "Stone", "nina.stone@example.com", DateTime.UtcNow);
            deeperReport.AssignManager(report.Id);

            seedContext.Employees.AddRange(executive, manager, report, deeperReport);
            await seedContext.SaveChangesAsync();
            managerId = manager.Id;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(
            new GetEmployeeOrgChartQuery(managerId, MaxDepth: 1),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.IsTruncated);
        Assert.Equal(2, result.Value.TotalVisibleNodeCount);

        var root = Assert.Single(result.Value.Roots);
        Assert.Equal(managerId, root.EmployeeId);

        var reportNode = Assert.Single(root.Children);
        Assert.True(reportNode.HasChildren);
        Assert.Empty(reportNode.Children);
        Assert.Equal(1, reportNode.DirectReportCount);
    }

    [Fact]
    public async Task GetEmployeeOrgChart_WithoutInactiveManagers_SurfacesActiveReportsAsOrphanRoots()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var inactiveManager = Employee.Create(TenantId, "Casey", "Inactive", "casey.inactive@example.com", DateTime.UtcNow);
            inactiveManager.Deactivate();

            var report = Employee.Create(TenantId, "Robin", "Active", "robin.active@example.com", DateTime.UtcNow);
            report.AssignManager(inactiveManager.Id);

            seedContext.Employees.AddRange(inactiveManager, report);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeOrgChartQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var root = Assert.Single(result.Value.Roots);
        Assert.True(root.IsOrphaned);
        Assert.Equal(EmployeeHierarchyStatuses.ManagerInactive, root.HierarchyStatus);
        Assert.Equal("robin.active@example.com", root.Email);
    }

    [Fact]
    public async Task GetEmployeeOrgChart_WithIncludeInactive_KeepsInactiveManagersInTree()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var inactiveManager = Employee.Create(TenantId, "Casey", "Inactive", "casey.inactive@example.com", DateTime.UtcNow);
            inactiveManager.Deactivate();

            var report = Employee.Create(TenantId, "Robin", "Active", "robin.active@example.com", DateTime.UtcNow);
            report.AssignManager(inactiveManager.Id);

            seedContext.Employees.AddRange(inactiveManager, report);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeOrgChartQuery(IncludeInactive: true), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var root = Assert.Single(result.Value.Roots);
        Assert.Equal("casey.inactive@example.com", root.Email);
        Assert.Equal(EmployeeStatus.Inactive, root.EmploymentStatus);
        Assert.Single(root.Children);
        Assert.Equal("robin.active@example.com", root.Children[0].Email);
    }

    [Fact]
    public async Task GetEmployeeOrgChart_WithUnknownRootEmployeeId_ReturnsNotFound()
    {
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeOrgChartQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task GetEmployeeOrgChart_FromDifferentTenant_ReturnsNotFound()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        Guid employeeId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var employee = Employee.Create(tenantA, "John", "Doe", "john@example.com", DateTime.UtcNow);
            seedContext.Employees.Add(employee);
            await seedContext.SaveChangesAsync();
            employeeId = employee.Id;
        }

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenantB), dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeOrgChartQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    private static GetEmployeeOrgChartQueryHandler CreateHandler(CoreHRDbContext context)
        => new(context, new EmployeeReadModelPolicy(), new TenantSettingsReadService(context));
}
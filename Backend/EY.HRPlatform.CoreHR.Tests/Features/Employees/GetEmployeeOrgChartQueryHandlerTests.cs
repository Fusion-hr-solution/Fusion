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

    [Fact]
    public async Task GetEmployeeOrgChart_WithFocusEmployeeId_ResolvesRootAndReturnsFocusedEmployeeId()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        Guid reportId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow);
            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow);
            manager.AssignManager(executive.Id);
            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
            report.AssignManager(manager.Id);

            seedContext.Employees.AddRange(executive, manager, report);
            await seedContext.SaveChangesAsync();
            reportId = report.Id;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(
            new GetEmployeeOrgChartQuery(FocusEmployeeId: reportId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(reportId, result.Value.FocusedEmployeeId);
        // Chart is rooted at the executive (topmost ancestor)
        var root = Assert.Single(result.Value.Roots);
        Assert.Equal("emma.executive@example.com", root.Email);
        // All 3 employees should be in the tree
        Assert.Equal(3, result.Value.TotalVisibleNodeCount);
    }

    [Fact]
    public async Task GetEmployeeOrgChart_WithUnknownFocusEmployeeId_ReturnsNotFound()
    {
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var context = TestDbContextFactory.Create(tenantContext);
        var handler = CreateHandler(context);

        var result = await handler.Handle(
            new GetEmployeeOrgChartQuery(FocusEmployeeId: Guid.NewGuid()),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task GetEmployeeOrgChart_WithOrgUnitId_IncludesOrgUnitEmployeesAndAncestors()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        Guid orgUnitAId;

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var orgUnitA = OrgUnit.Create(TenantId, "OU-A", "Org Unit A", "Department", null);
            var orgUnitB = OrgUnit.Create(TenantId, "OU-B", "Org Unit B", "Department", null);

            // executive is in org unit B (ancestor manager, different unit)
            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow);
            executive.AssignOrgUnit(orgUnitB.Id);

            // manager and report are in org unit A
            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow);
            manager.AssignManager(executive.Id);
            manager.AssignOrgUnit(orgUnitA.Id);

            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
            report.AssignManager(manager.Id);
            report.AssignOrgUnit(orgUnitA.Id);

            // unrelated employee in org unit B should not appear
            var unrelated = Employee.Create(TenantId, "Bob", "Other", "bob.other@example.com", DateTime.UtcNow);
            unrelated.AssignOrgUnit(orgUnitB.Id);

            seedContext.OrgUnits.AddRange(orgUnitA, orgUnitB);
            seedContext.Employees.AddRange(executive, manager, report, unrelated);
            await seedContext.SaveChangesAsync();
            orgUnitAId = orgUnitA.Id;
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(
            new GetEmployeeOrgChartQuery(OrgUnitId: orgUnitAId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(orgUnitAId, result.Value.SelectedOrgUnitId);
        // All 3 employees should appear: manager + report (org unit A) + executive (ancestor)
        // But NOT the unrelated employee in org unit B
        Assert.Equal(3, result.Value.TotalVisibleNodeCount);
        var emails = result.Value.Roots.SelectMany(FlattenNodes).Select(n => n.Email).ToHashSet();
        Assert.Contains("emma.executive@example.com", emails);
        Assert.Contains("alex.manager@example.com", emails);
        Assert.Contains("sarah.chen@example.com", emails);
        Assert.DoesNotContain("bob.other@example.com", emails);
    }

    [Fact]
    public async Task GetEmployeeOrgChart_IssueCountsReflectVisibleEmployees()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            // legitimate top-level leader should not count as a no-manager issue
            var topLevel = Employee.Create(TenantId, "Emma", "Executive", "emma@example.com", DateTime.UtcNow);
            var topLevelReport = Employee.Create(TenantId, "Casey", "Report", "casey@example.com", DateTime.UtcNow);
            topLevelReport.AssignManager(topLevel.Id);

            // 1 isolated employee with no manager should still count
            var isolated = Employee.Create(TenantId, "Jordan", "Solo", "jordan@example.com", DateTime.UtcNow);

            // 1 employee with an inactive manager
            var inactiveManager = Employee.Create(TenantId, "Inactive", "Manager", "inactive@example.com", DateTime.UtcNow);
            inactiveManager.AssignManager(topLevel.Id);
            inactiveManager.Deactivate();
            var reportOfInactive = Employee.Create(TenantId, "Robin", "Active", "robin@example.com", DateTime.UtcNow);
            reportOfInactive.AssignManager(inactiveManager.Id);

            seedContext.Employees.AddRange(topLevel, topLevelReport, isolated, inactiveManager, reportOfInactive);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        // Include inactive so all employees are loaded
        var result = await handler.Handle(new GetEmployeeOrgChartQuery(IncludeInactive: true), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var topLevelNode = result.Value.Roots.SelectMany(FlattenNodes).Single(node => node.Email == "emma@example.com");
        var isolatedNode = result.Value.Roots.SelectMany(FlattenNodes).Single(node => node.Email == "jordan@example.com");

        Assert.Equal(EmployeeHierarchyStatuses.Root, topLevelNode.HierarchyStatus);
        Assert.Equal(EmployeeHierarchyStatuses.NoManagerAssigned, isolatedNode.HierarchyStatus);
        Assert.Equal(1, result.Value.IssueCounts.ManagerInactive);
        Assert.Equal(1, result.Value.IssueCounts.NoManagerAssigned);
        Assert.True(result.Value.IssueCounts.MissingOrgUnit >= 1);
    }

    private static IEnumerable<EmployeeOrgChartNodeDto> FlattenNodes(EmployeeOrgChartNodeDto node)
    {
        yield return node;
        foreach (var child in node.Children.SelectMany(FlattenNodes))
        {
            yield return child;
        }
    }

    private static GetEmployeeOrgChartQueryHandler CreateHandler(CoreHRDbContext context)
        => new(context, new EmployeeReadModelPolicy(), new TenantSettingsReadService(context));
}
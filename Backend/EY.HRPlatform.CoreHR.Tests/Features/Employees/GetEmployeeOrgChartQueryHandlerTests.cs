using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeOrgChart;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class GetEmployeeOrgChartQueryHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    // ── seeding helpers ─────────────────────────────────────────────────────────

    private static Employment StartEmp(Guid tenantId, Guid employeeId)
        => Employment.Start(tenantId, employeeId, DateTime.UtcNow.AddMonths(-6), null, WorkforceSourceType.Manual);

    private static WorkAssignment CreateAssignment(Guid tenantId, Employment employment, Guid employeeId, Guid orgUnitId)
        => WorkAssignment.Create(
            tenantId, employment.Id, employeeId, orgUnitId,
            "N/A", null, true, employment.EffectiveFrom, null, WorkforceSourceType.Manual);

    private static ManagerRelationship CreateLink(
        Guid tenantId,
        Employee subject, WorkAssignment subjectAssignment,
        Employee manager, WorkAssignment managerAssignment)
        => ManagerRelationship.Create(
            tenantId, subject.Id, manager.Id,
            subjectAssignment.Id, managerAssignment.Id,
            ReportingRelationshipType.PrimaryManager,
            subjectAssignment.EffectiveFrom, WorkforceSourceType.Manual);

    // ── tests ────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetEmployeeOrgChart_WithoutRoot_ReturnsForestForVisibleEmployees()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var orgUnit = OrgUnit.Create(TenantId, "SHARED", "Shared", "Department", null);

            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var execEmp = StartEmp(TenantId, executive.Id);
            var execAssignment = CreateAssignment(TenantId, execEmp, executive.Id, orgUnit.Id);

            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var mgrEmp = StartEmp(TenantId, manager.Id);
            var mgrAssignment = CreateAssignment(TenantId, mgrEmp, manager.Id, orgUnit.Id);
            var mgrLink = CreateLink(TenantId, manager, mgrAssignment, executive, execAssignment);

            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var rptEmp = StartEmp(TenantId, report.Id);
            var rptAssignment = CreateAssignment(TenantId, rptEmp, report.Id, orgUnit.Id);
            var rptLink = CreateLink(TenantId, report, rptAssignment, manager, mgrAssignment);

            var rootWithoutManager = Employee.Create(TenantId, "Jordan", "Root", "jordan.root@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var rootEmp = StartEmp(TenantId, rootWithoutManager.Id);

            seedContext.OrgUnits.Add(orgUnit);
            seedContext.Employees.AddRange(executive, manager, report, rootWithoutManager);
            seedContext.Employments.AddRange(execEmp, mgrEmp, rptEmp, rootEmp);
            seedContext.WorkAssignments.AddRange(execAssignment, mgrAssignment, rptAssignment);
            seedContext.ManagerRelationships.AddRange(mgrLink, rptLink);
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
            var orgUnit = OrgUnit.Create(TenantId, "SHARED", "Shared", "Department", null);

            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var execEmp = StartEmp(TenantId, executive.Id);
            var execAssignment = CreateAssignment(TenantId, execEmp, executive.Id, orgUnit.Id);

            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var mgrEmp = StartEmp(TenantId, manager.Id);
            var mgrAssignment = CreateAssignment(TenantId, mgrEmp, manager.Id, orgUnit.Id);
            var mgrLink = CreateLink(TenantId, manager, mgrAssignment, executive, execAssignment);

            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var rptEmp = StartEmp(TenantId, report.Id);
            var rptAssignment = CreateAssignment(TenantId, rptEmp, report.Id, orgUnit.Id);
            var rptLink = CreateLink(TenantId, report, rptAssignment, manager, mgrAssignment);

            seedContext.OrgUnits.Add(orgUnit);
            seedContext.Employees.AddRange(executive, manager, report);
            seedContext.Employments.AddRange(execEmp, mgrEmp, rptEmp);
            seedContext.WorkAssignments.AddRange(execAssignment, mgrAssignment, rptAssignment);
            seedContext.ManagerRelationships.AddRange(mgrLink, rptLink);
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
            var orgUnit = OrgUnit.Create(TenantId, "SHARED", "Shared", "Department", null);

            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var execEmp = StartEmp(TenantId, executive.Id);
            var execAssignment = CreateAssignment(TenantId, execEmp, executive.Id, orgUnit.Id);

            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var mgrEmp = StartEmp(TenantId, manager.Id);
            var mgrAssignment = CreateAssignment(TenantId, mgrEmp, manager.Id, orgUnit.Id);
            var mgrLink = CreateLink(TenantId, manager, mgrAssignment, executive, execAssignment);

            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var rptEmp = StartEmp(TenantId, report.Id);
            var rptAssignment = CreateAssignment(TenantId, rptEmp, report.Id, orgUnit.Id);
            var rptLink = CreateLink(TenantId, report, rptAssignment, manager, mgrAssignment);

            seedContext.OrgUnits.Add(orgUnit);
            seedContext.Employees.AddRange(executive, manager, report);
            seedContext.Employments.AddRange(execEmp, mgrEmp, rptEmp);
            seedContext.WorkAssignments.AddRange(execAssignment, mgrAssignment, rptAssignment);
            seedContext.ManagerRelationships.AddRange(mgrLink, rptLink);
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
            var orgUnit = OrgUnit.Create(TenantId, "SHARED", "Shared", "Department", null);

            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var execEmp = StartEmp(TenantId, executive.Id);
            var execAssignment = CreateAssignment(TenantId, execEmp, executive.Id, orgUnit.Id);

            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var mgrEmp = StartEmp(TenantId, manager.Id);
            var mgrAssignment = CreateAssignment(TenantId, mgrEmp, manager.Id, orgUnit.Id);
            var mgrLink = CreateLink(TenantId, manager, mgrAssignment, executive, execAssignment);

            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var rptEmp = StartEmp(TenantId, report.Id);
            var rptAssignment = CreateAssignment(TenantId, rptEmp, report.Id, orgUnit.Id);
            var rptLink = CreateLink(TenantId, report, rptAssignment, manager, mgrAssignment);

            var deeper = Employee.Create(TenantId, "Nina", "Stone", "nina.stone@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var deeperEmp = StartEmp(TenantId, deeper.Id);
            var deeperAssignment = CreateAssignment(TenantId, deeperEmp, deeper.Id, orgUnit.Id);
            var deeperLink = CreateLink(TenantId, deeper, deeperAssignment, report, rptAssignment);

            seedContext.OrgUnits.Add(orgUnit);
            seedContext.Employees.AddRange(executive, manager, report, deeper);
            seedContext.Employments.AddRange(execEmp, mgrEmp, rptEmp, deeperEmp);
            seedContext.WorkAssignments.AddRange(execAssignment, mgrAssignment, rptAssignment, deeperAssignment);
            seedContext.ManagerRelationships.AddRange(mgrLink, rptLink, deeperLink);
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
        var yesterday = DateTime.UtcNow.AddDays(-1);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var orgUnit = OrgUnit.Create(TenantId, "SHARED", "Shared", "Department", null);

            // Inactive manager: employment ended yesterday
            var inactiveManager = Employee.Create(TenantId, "Casey", "Inactive", "casey.inactive@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var inactiveMgrEmp = Employment.Start(TenantId, inactiveManager.Id, DateTime.UtcNow.AddMonths(-6), null, WorkforceSourceType.Manual);
            inactiveMgrEmp.End(yesterday);
            var inactiveMgrAssignment = WorkAssignment.Create(
                TenantId, inactiveMgrEmp.Id, inactiveManager.Id, orgUnit.Id,
                "N/A", null, true, inactiveMgrEmp.EffectiveFrom, yesterday, WorkforceSourceType.Manual);

            // Active report with ManagerRelationship still pointing to inactive manager
            var report = Employee.Create(TenantId, "Robin", "Active", "robin.active@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var reportEmp = StartEmp(TenantId, report.Id);
            var reportAssignment = CreateAssignment(TenantId, reportEmp, report.Id, orgUnit.Id);
            var managerLink = ManagerRelationship.Create(
                TenantId, report.Id, inactiveManager.Id,
                reportAssignment.Id, inactiveMgrAssignment.Id,
                ReportingRelationshipType.PrimaryManager,
                reportAssignment.EffectiveFrom, WorkforceSourceType.Manual);

            seedContext.OrgUnits.Add(orgUnit);
            seedContext.Employees.AddRange(inactiveManager, report);
            seedContext.Employments.AddRange(inactiveMgrEmp, reportEmp);
            seedContext.WorkAssignments.AddRange(inactiveMgrAssignment, reportAssignment);
            seedContext.ManagerRelationships.Add(managerLink);
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
        var yesterday = DateTime.UtcNow.AddDays(-1);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var orgUnit = OrgUnit.Create(TenantId, "SHARED", "Shared", "Department", null);

            var inactiveManager = Employee.Create(TenantId, "Casey", "Inactive", "casey.inactive@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var inactiveMgrEmp = Employment.Start(TenantId, inactiveManager.Id, DateTime.UtcNow.AddMonths(-6), null, WorkforceSourceType.Manual);
            inactiveMgrEmp.End(yesterday);
            var inactiveMgrAssignment = WorkAssignment.Create(
                TenantId, inactiveMgrEmp.Id, inactiveManager.Id, orgUnit.Id,
                "N/A", null, true, inactiveMgrEmp.EffectiveFrom, yesterday, WorkforceSourceType.Manual);

            var report = Employee.Create(TenantId, "Robin", "Active", "robin.active@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var reportEmp = StartEmp(TenantId, report.Id);
            var reportAssignment = CreateAssignment(TenantId, reportEmp, report.Id, orgUnit.Id);
            var managerLink = ManagerRelationship.Create(
                TenantId, report.Id, inactiveManager.Id,
                reportAssignment.Id, inactiveMgrAssignment.Id,
                ReportingRelationshipType.PrimaryManager,
                reportAssignment.EffectiveFrom, WorkforceSourceType.Manual);

            seedContext.OrgUnits.Add(orgUnit);
            seedContext.Employees.AddRange(inactiveManager, report);
            seedContext.Employments.AddRange(inactiveMgrEmp, reportEmp);
            seedContext.WorkAssignments.AddRange(inactiveMgrAssignment, reportAssignment);
            seedContext.ManagerRelationships.Add(managerLink);
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
            var employee = Employee.Create(tenantA, "John", "Doe", "john@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
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
            var orgUnit = OrgUnit.Create(TenantId, "SHARED", "Shared", "Department", null);

            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var execEmp = StartEmp(TenantId, executive.Id);
            var execAssignment = CreateAssignment(TenantId, execEmp, executive.Id, orgUnit.Id);

            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var mgrEmp = StartEmp(TenantId, manager.Id);
            var mgrAssignment = CreateAssignment(TenantId, mgrEmp, manager.Id, orgUnit.Id);
            var mgrLink = CreateLink(TenantId, manager, mgrAssignment, executive, execAssignment);

            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var rptEmp = StartEmp(TenantId, report.Id);
            var rptAssignment = CreateAssignment(TenantId, rptEmp, report.Id, orgUnit.Id);
            var rptLink = CreateLink(TenantId, report, rptAssignment, manager, mgrAssignment);

            seedContext.OrgUnits.Add(orgUnit);
            seedContext.Employees.AddRange(executive, manager, report);
            seedContext.Employments.AddRange(execEmp, mgrEmp, rptEmp);
            seedContext.WorkAssignments.AddRange(execAssignment, mgrAssignment, rptAssignment);
            seedContext.ManagerRelationships.AddRange(mgrLink, rptLink);
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
        var root = Assert.Single(result.Value.Roots);
        Assert.Equal("emma.executive@example.com", root.Email);
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
            var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var execEmp = StartEmp(TenantId, executive.Id);
            var execAssignment = WorkAssignment.Create(
                TenantId, execEmp.Id, executive.Id, orgUnitB.Id,
                "N/A", null, true, execEmp.EffectiveFrom, null, WorkforceSourceType.Manual);

            // manager in org unit A, reports to executive
            var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var mgrEmp = StartEmp(TenantId, manager.Id);
            var mgrAssignment = WorkAssignment.Create(
                TenantId, mgrEmp.Id, manager.Id, orgUnitA.Id,
                "N/A", null, true, mgrEmp.EffectiveFrom, null, WorkforceSourceType.Manual);
            var mgrLink = CreateLink(TenantId, manager, mgrAssignment, executive, execAssignment);

            // report in org unit A, reports to manager
            var report = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var rptEmp = StartEmp(TenantId, report.Id);
            var rptAssignment = WorkAssignment.Create(
                TenantId, rptEmp.Id, report.Id, orgUnitA.Id,
                "N/A", null, true, rptEmp.EffectiveFrom, null, WorkforceSourceType.Manual);
            var rptLink = CreateLink(TenantId, report, rptAssignment, manager, mgrAssignment);

            // unrelated in org unit B — should NOT appear
            var unrelated = Employee.Create(TenantId, "Bob", "Other", "bob.other@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var unrelatedEmp = StartEmp(TenantId, unrelated.Id);

            seedContext.OrgUnits.AddRange(orgUnitA, orgUnitB);
            seedContext.Employees.AddRange(executive, manager, report, unrelated);
            seedContext.Employments.AddRange(execEmp, mgrEmp, rptEmp, unrelatedEmp);
            seedContext.WorkAssignments.AddRange(execAssignment, mgrAssignment, rptAssignment);
            seedContext.ManagerRelationships.AddRange(mgrLink, rptLink);
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
        var yesterday = DateTime.UtcNow.AddDays(-1);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var orgUnit = OrgUnit.Create(TenantId, "SHARED", "Shared", "Department", null);

            // top-level leader (root) — has reports, no manager → Root hierarchy status, not an issue
            var topLevel = Employee.Create(TenantId, "Emma", "Executive", "emma@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var topEmp = StartEmp(TenantId, topLevel.Id);
            var topAssignment = CreateAssignment(TenantId, topEmp, topLevel.Id, orgUnit.Id);

            var topLevelReport = Employee.Create(TenantId, "Casey", "Report", "casey@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var topRptEmp = StartEmp(TenantId, topLevelReport.Id);
            var topRptAssignment = CreateAssignment(TenantId, topRptEmp, topLevelReport.Id, orgUnit.Id);
            var topRptLink = CreateLink(TenantId, topLevelReport, topRptAssignment, topLevel, topAssignment);

            // isolated employee: no manager, no reports → NoManagerAssigned
            var isolated = Employee.Create(TenantId, "Jordan", "Solo", "jordan@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var isolatedEmp = StartEmp(TenantId, isolated.Id);
            // no WorkAssignment → also MissingOrgUnit

            // inactive manager: employment ended → ManagerInactive count
            var inactiveManager = Employee.Create(TenantId, "Inactive", "Manager", "inactive@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var inactiveMgrEmp = Employment.Start(TenantId, inactiveManager.Id, DateTime.UtcNow.AddMonths(-6), null, WorkforceSourceType.Manual);
            inactiveMgrEmp.End(yesterday);
            var inactiveMgrAssignment = WorkAssignment.Create(
                TenantId, inactiveMgrEmp.Id, inactiveManager.Id, orgUnit.Id,
                "N/A", null, true, inactiveMgrEmp.EffectiveFrom, yesterday, WorkforceSourceType.Manual);

            var reportOfInactive = Employee.Create(TenantId, "Robin", "Active", "robin@example.com", DateTime.UtcNow, employeeNumber: TestEmployeeNumbers.Next());
            var robinEmp = StartEmp(TenantId, reportOfInactive.Id);
            var robinAssignment = CreateAssignment(TenantId, robinEmp, reportOfInactive.Id, orgUnit.Id);
            var robinLink = ManagerRelationship.Create(
                TenantId, reportOfInactive.Id, inactiveManager.Id,
                robinAssignment.Id, inactiveMgrAssignment.Id,
                ReportingRelationshipType.PrimaryManager,
                robinAssignment.EffectiveFrom, WorkforceSourceType.Manual);

            seedContext.OrgUnits.Add(orgUnit);
            seedContext.Employees.AddRange(topLevel, topLevelReport, isolated, inactiveManager, reportOfInactive);
            seedContext.Employments.AddRange(topEmp, topRptEmp, isolatedEmp, inactiveMgrEmp, robinEmp);
            seedContext.WorkAssignments.AddRange(topAssignment, topRptAssignment, inactiveMgrAssignment, robinAssignment);
            seedContext.ManagerRelationships.AddRange(topRptLink, robinLink);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        // includeInactive=true so all employees (including inactive manager) are loaded
        var result = await handler.Handle(new GetEmployeeOrgChartQuery(IncludeInactive: true), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var topLevelNode = result.Value.Roots.SelectMany(FlattenNodes).Single(n => n.Email == "emma@example.com");
        var isolatedNode = result.Value.Roots.SelectMany(FlattenNodes).Single(n => n.Email == "jordan@example.com");

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
            yield return child;
    }

    private static GetEmployeeOrgChartQueryHandler CreateHandler(EY.HRPlatform.CoreHR.Infrastructure.Persistence.CoreHRDbContext context)
        => new(context, new TenantSettingsReadService(context));
}

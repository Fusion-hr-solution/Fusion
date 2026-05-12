using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeReportingLines;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class GetEmployeeReportingLinesQueryHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task GetEmployeeReportingLines_ReturnsManagerChainDirectReportsAndDownline()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var executive = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow);
        var manager = Employee.Create(TenantId, "Alex", "Manager", "alex.manager@example.com", DateTime.UtcNow);
        manager.AssignManager(executive.Id);
        var reportOne = Employee.Create(TenantId, "Sarah", "Chen", "sarah.chen@example.com", DateTime.UtcNow);
        reportOne.AssignManager(manager.Id);
        var reportTwo = Employee.Create(TenantId, "Jordan", "Ray", "jordan.ray@example.com", DateTime.UtcNow);
        reportTwo.AssignManager(manager.Id);
        var indirectReport = Employee.Create(TenantId, "Priya", "Singh", "priya.singh@example.com", DateTime.UtcNow);
        indirectReport.AssignManager(reportOne.Id);

        seedContext.Employees.AddRange(executive, manager, reportOne, reportTwo, indirectReport);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeReportingLinesQuery(manager.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(manager.Id, result.Value.Employee.Id);
        Assert.Equal(2, result.Value.DirectReportCount);
        Assert.Equal(3, result.Value.DownlineCount);

        var managerChainItem = Assert.Single(result.Value.ManagerChain);
        Assert.Equal(executive.Id, managerChainItem.Employee.Id);
        Assert.Equal(1, managerChainItem.Depth);

        Assert.Equal(2, result.Value.DirectReports.Count);
        Assert.All(result.Value.DirectReports, node => Assert.Equal(1, node.Depth));
        Assert.Equal(
            ["jordan.ray@example.com", "sarah.chen@example.com"],
            result.Value.DirectReports.Select(node => node.Employee.Email).OrderBy(email => email).ToArray());

        Assert.Equal(3, result.Value.Downline.Count);
        Assert.Contains(result.Value.Downline, node => node.Employee.Id == reportOne.Id && node.Depth == 1);
        Assert.Contains(result.Value.Downline, node => node.Employee.Id == reportTwo.Id && node.Depth == 1);
        Assert.Contains(result.Value.Downline, node => node.Employee.Id == indirectReport.Id && node.Depth == 2);
    }

    [Fact]
    public async Task GetEmployeeReportingLines_WithoutManager_ReturnsExplicitNoManagerState()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);

        var employee = Employee.Create(TenantId, "Solo", "Leader", "solo.leader@example.com", DateTime.UtcNow);
        seedContext.Employees.Add(employee);
        await seedContext.SaveChangesAsync();

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = CreateHandler(context);

        var result = await handler.Handle(new GetEmployeeReportingLinesQuery(employee.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(EmployeeHierarchyStatuses.NoManagerAssigned, result.Value.Employee.HierarchyStatus);
        Assert.Empty(result.Value.ManagerChain);
        Assert.Empty(result.Value.DirectReports);
        Assert.Empty(result.Value.Downline);
    }

    [Fact]
    public async Task GetEmployeeReportingLines_FromDifferentTenant_ReturnsNotFound()
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

        var result = await handler.Handle(new GetEmployeeReportingLinesQuery(employeeId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code);
    }

    private static GetEmployeeReportingLinesQueryHandler CreateHandler(CoreHRDbContext context)
        => new(context, new EmployeeReadModelPolicy(), new TenantSettingsReadService(context));
}
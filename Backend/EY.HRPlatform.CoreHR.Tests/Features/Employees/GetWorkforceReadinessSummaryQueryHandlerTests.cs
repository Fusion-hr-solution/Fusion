using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetWorkforceReadinessSummary;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class GetWorkforceReadinessSummaryQueryHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task GetWorkforceReadinessSummary_ComputesScoreCountsAndUnresolvedImportIssues()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantContext = TestTenantContext.WithTenant(TenantId);

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var orgUnit = OrgUnit.Create(TenantId, "EXEC", "Executive", "Department", null);
            var leader = Employee.Create(TenantId, "Emma", "Executive", "emma.executive@example.com", DateTime.UtcNow, null, "Chief People Officer");
            leader.AssignOrgUnit(orgUnit.Id);

            var report = Employee.Create(TenantId, "Casey", "Report", "casey.report@example.com", DateTime.UtcNow, null, "People Partner");
            report.AssignManager(leader.Id);
            report.AssignOrgUnit(orgUnit.Id);

            var missingOrgUnit = Employee.Create(TenantId, "Jordan", "Solo", "jordan.solo@example.com", DateTime.UtcNow, null, "Analyst");

            var inactive = Employee.Create(TenantId, "Inactive", "Person", "inactive.person@example.com", DateTime.UtcNow, null, "Analyst");
            inactive.AssignOrgUnit(orgUnit.Id);
            inactive.Deactivate();

            var history = EmployeeImportHistory.CreateApplied(
                TenantId,
                Guid.NewGuid(),
                "employees.csv",
                100,
                1,
                1,
                1,
                0,
                DateTime.UtcNow,
                Guid.NewGuid(),
                "HR Admin",
                "HRAdmin");

            seedContext.OrgUnits.Add(orgUnit);
            seedContext.Employees.AddRange(leader, report, missingOrgUnit, inactive);
            seedContext.EmployeeImportHistories.Add(history);
            seedContext.EmployeeImportFollowUpIssues.Add(EmployeeImportFollowUpIssue.Create(
                TenantId,
                history.Id,
                missingOrgUnit.Id,
                1,
                EmployeeReadinessIssueCodes.MissingOrgUnit,
                "orgUnitId"));
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(tenantContext, dbName);
        var handler = new GetWorkforceReadinessSummaryQueryHandler(context, new TenantSettingsReadService(context));

        var result = await handler.Handle(new GetWorkforceReadinessSummaryQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.ActiveEmployeeCount);
        Assert.Equal(2, result.Value.ReadyEmployeeCount);
        Assert.Equal(1, result.Value.EmployeesNeedingAttention);
        Assert.Equal(66.7m, result.Value.ReadinessScore);
        Assert.Equal(1, result.Value.IssueCounts.MissingOrgUnit);
        Assert.Equal(1, result.Value.IssueCounts.NoManagerAssigned);
        Assert.Equal(1, result.Value.IssueCounts.DeactivationBlocked);
        Assert.Equal(1, result.Value.IssueCounts.UnresolvedImportIssues);
    }
}
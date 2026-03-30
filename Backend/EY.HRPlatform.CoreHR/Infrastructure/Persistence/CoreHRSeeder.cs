using EY.HRPlatform.CoreHR.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence;

/// <summary>
/// Seeds initial data for CoreHR module (development/demo environments).
/// </summary>
public static class CoreHRSeeder
{
    public static async Task SeedAsync(CoreHRDbContext dbContext, Guid tenantId)
    {
        await SeedOrgUnits(dbContext, tenantId);
    }

    private static async Task SeedOrgUnits(CoreHRDbContext dbContext, Guid tenantId)
    {
        // Skip if OrgUnits already exist for this tenant
        if (await dbContext.OrgUnits.IgnoreQueryFilters().AnyAsync(o => o.TenantId == tenantId))
            return;

        // Create root departments
        var engineering = OrgUnit.Create(tenantId, "ENG", "Engineering", "Department", null);
        var hr = OrgUnit.Create(tenantId, "HR", "Human Resources", "Department", null);
        var sales = OrgUnit.Create(tenantId, "SALES", "Sales", "Department", null);

        dbContext.OrgUnits.AddRange(engineering, hr, sales);
        await dbContext.SaveChangesAsync();

        // Create teams under departments
        var platformTeam = OrgUnit.Create(tenantId, "ENG-PLATFORM", "Platform Team", "Team", engineering.Id);
        var frontendTeam = OrgUnit.Create(tenantId, "ENG-FRONTEND", "Frontend Team", "Team", engineering.Id);
        var backendTeam = OrgUnit.Create(tenantId, "ENG-BACKEND", "Backend Team", "Team", engineering.Id);
        var recruiting = OrgUnit.Create(tenantId, "HR-RECRUIT", "Recruiting", "Team", hr.Id);
        var peopleOps = OrgUnit.Create(tenantId, "HR-OPS", "People Ops", "Team", hr.Id);
        var enterpriseSales = OrgUnit.Create(tenantId, "SALES-ENT", "Enterprise Sales", "Team", sales.Id);

        dbContext.OrgUnits.AddRange(platformTeam, frontendTeam, backendTeam, recruiting, peopleOps, enterpriseSales);
        await dbContext.SaveChangesAsync();
    }
}

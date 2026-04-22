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
        await SeedSetupState(dbContext, tenantId);
        await SeedOrgUnits(dbContext, tenantId);
        await SeedEmployees(dbContext, tenantId);
    }

    private static async Task SeedSetupState(CoreHRDbContext dbContext, Guid tenantId)
    {
        // Idempotent: skip if a setup state already exists for this tenant
        if (await dbContext.TenantSetupStates.IgnoreQueryFilters().AnyAsync(s => s.TenantId == tenantId))
            return;

        // Advance through the state machine to StructurallyPublished so the
        // frontend setup gate passes and employees/org units are accessible.
        var setupState = TenantSetupState.CreateActivated(tenantId);
        setupState.Approve(
            Guid.Parse("00000000-0000-0000-0000-000000000001"),
            "System Seeder",
            "PlatformAdmin",
            isPlatformAssisted: true);
        setupState.Publish();

        dbContext.TenantSetupStates.Add(setupState);
        await dbContext.SaveChangesAsync();
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

    private static async Task SeedEmployees(CoreHRDbContext db, Guid tenantId)
    {
        // Idempotent: skip if employees already exist for this tenant
        if (await db.Employees.IgnoreQueryFilters().AnyAsync(e => e.TenantId == tenantId))
            return;

        // Create employees without managers first
        var vpEng = Employee.Create(
            tenantId,
            "Robert", "Taylor",
            "robert.taylor@ey-hr.com",
            new DateTime(2018, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            "Engineering", "VP of Engineering");

        var hrDirector = Employee.Create(
            tenantId,
            "Maria", "Garcia",
            "maria.garcia@ey-hr.com",
            new DateTime(2021, 3, 10, 0, 0, 0, DateTimeKind.Utc),
            "Human Resources", "HR Director");

        var financeDirector = Employee.Create(
            tenantId,
            "Lisa", "Brown",
            "lisa.brown@ey-hr.com",
            new DateTime(2020, 11, 1, 0, 0, 0, DateTimeKind.Utc),
            "Finance", "Finance Director");

        var marketingDirector = Employee.Create(
            tenantId,
            "Michael", "Lee",
            "michael.lee@ey-hr.com",
            new DateTime(2019, 7, 15, 0, 0, 0, DateTimeKind.Utc),
            "Marketing", "Marketing Director");

        // Save directors first to get IDs
        await db.Employees.AddRangeAsync(vpEng, hrDirector, financeDirector, marketingDirector);
        await db.SaveChangesAsync();

        // Create tech lead reporting to VP
        var techLead = Employee.Create(
            tenantId,
            "James", "Wilson",
            "james.wilson@ey-hr.com",
            new DateTime(2022, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            "Engineering", "Tech Lead");
        techLead.AssignManager(vpEng.Id);

        // Create employees with managers
        var seniorDev = Employee.Create(
            tenantId,
            "Sarah", "Chen",
            "sarah.chen@ey-hr.com",
            new DateTime(2023, 1, 15, 0, 0, 0, DateTimeKind.Utc),
            "Engineering", "Senior Software Engineer");
        
        var juniorDev = Employee.Create(
            tenantId,
            "Alex", "Kumar",
            "alex.kumar@ey-hr.com",
            new DateTime(2024, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            "Engineering", "Junior Software Engineer");

        var hrSpecialist = Employee.Create(
            tenantId,
            "Emma", "Rodriguez",
            "emma.rodriguez@ey-hr.com",
            new DateTime(2023, 5, 20, 0, 0, 0, DateTimeKind.Utc),
            "Human Resources", "HR Specialist");
        hrSpecialist.AssignManager(hrDirector.Id);

        var financialAnalyst = Employee.Create(
            tenantId,
            "David", "Kim",
            "david.kim@ey-hr.com",
            new DateTime(2023, 8, 20, 0, 0, 0, DateTimeKind.Utc),
            "Finance", "Financial Analyst");
        financialAnalyst.AssignManager(financeDirector.Id);

        var marketingSpecialist = Employee.Create(
            tenantId,
            "Emily", "Johnson",
            "emily.johnson@ey-hr.com",
            new DateTime(2022, 2, 14, 0, 0, 0, DateTimeKind.Utc),
            "Marketing", "Marketing Specialist");
        marketingSpecialist.AssignManager(marketingDirector.Id);

        // Add tech lead
        await db.Employees.AddAsync(techLead);
        await db.SaveChangesAsync();

        // Assign managers to engineers
        seniorDev.AssignManager(techLead.Id);
        juniorDev.AssignManager(techLead.Id);

        // Add remaining employees
        await db.Employees.AddRangeAsync(
            seniorDev,
            juniorDev,
            hrSpecialist,
            financialAnalyst,
            marketingSpecialist);

        // Add one inactive employee for filter testing
        var formerEmployee = Employee.Create(
            tenantId,
            "John", "Smith",
            "john.smith@ey-hr.com",
            new DateTime(2020, 1, 10, 0, 0, 0, DateTimeKind.Utc),
            "Engineering", "Software Engineer");
        formerEmployee.AssignManager(techLead.Id);
        formerEmployee.Deactivate();

        await db.Employees.AddAsync(formerEmployee);
        await db.SaveChangesAsync();

        // Assign org units to employees that map to the seeded structure.
        // Finance/Marketing employees are intentionally left unlinked — their departments
        // have no matching org unit in the seeded structure, so they render with em-dash.
        var orgUnits = await db.OrgUnits.IgnoreQueryFilters()
            .Where(o => o.TenantId == tenantId && new[]
            {
                "ENG", "HR", "ENG-PLATFORM", "ENG-FRONTEND", "ENG-BACKEND", "HR-OPS"
            }.Contains(o.Code))
            .ToDictionaryAsync(o => o.Code);

        if (orgUnits.TryGetValue("ENG", out var engUnit))
            vpEng.AssignOrgUnit(engUnit.Id);

        if (orgUnits.TryGetValue("HR", out var hrUnit))
            hrDirector.AssignOrgUnit(hrUnit.Id);

        if (orgUnits.TryGetValue("ENG-PLATFORM", out var platformUnit))
            techLead.AssignOrgUnit(platformUnit.Id);

        if (orgUnits.TryGetValue("ENG-BACKEND", out var backendUnit))
        {
            seniorDev.AssignOrgUnit(backendUnit.Id);
            formerEmployee.AssignOrgUnit(backendUnit.Id);
        }

        if (orgUnits.TryGetValue("ENG-FRONTEND", out var frontendUnit))
            juniorDev.AssignOrgUnit(frontendUnit.Id);

        if (orgUnits.TryGetValue("HR-OPS", out var peopleOpsUnit))
            hrSpecialist.AssignOrgUnit(peopleOpsUnit.Id);

        await db.SaveChangesAsync();
    }
}

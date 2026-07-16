using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence;

/// <summary>
/// Seeds initial data for CoreHR module (development/demo environments).
/// </summary>
public static class CoreHRSeeder
{
    /// <summary>Deterministic actor id used when seeder calls domain methods that require a user id.</summary>
    private static readonly Guid SeederActorId = Guid.Parse("00000000-0000-0000-0000-000000000099");
    private const string SeederDisplayName = "System Seeder";

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
            SeederActorId,
            SeederDisplayName,
            PlatformRole.PlatformAdmin,
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
        var orgUnits = await db.OrgUnits.IgnoreQueryFilters()
            .Where(o => o.TenantId == tenantId && new[]
            {
                "ENG", "HR", "ENG-PLATFORM", "ENG-FRONTEND", "ENG-BACKEND", "HR-OPS"
            }.Contains(o.Code))
            .ToDictionaryAsync(o => o.Code);

        var seedEmployees = new[]
        {
            new SeedEmployee("Robert", "Taylor", "robert.taylor@ey-hr.com", "Engineering", "VP of Engineering", "ENG", null, new DateTime(2018, 3, 1, 0, 0, 0, DateTimeKind.Utc), true),
            new SeedEmployee("Maria", "Garcia", "maria.garcia@ey-hr.com", "Human Resources", "HR Director", "HR", null, new DateTime(2021, 3, 10, 0, 0, 0, DateTimeKind.Utc), true),
            new SeedEmployee("Lisa", "Brown", "lisa.brown@ey-hr.com", "Finance", "Finance Director", null, null, new DateTime(2020, 11, 1, 0, 0, 0, DateTimeKind.Utc), true),
            new SeedEmployee("Michael", "Lee", "michael.lee@ey-hr.com", "Marketing", "Marketing Director", null, null, new DateTime(2019, 7, 15, 0, 0, 0, DateTimeKind.Utc), true),
            new SeedEmployee("James", "Wilson", "james.wilson@ey-hr.com", "Engineering", "Tech Lead", "ENG-PLATFORM", "robert.taylor@ey-hr.com", new DateTime(2022, 6, 1, 0, 0, 0, DateTimeKind.Utc), true),
            new SeedEmployee("Sarah", "Chen", "sarah.chen@ey-hr.com", "Engineering", "Senior Software Engineer", "ENG-BACKEND", "james.wilson@ey-hr.com", new DateTime(2023, 1, 15, 0, 0, 0, DateTimeKind.Utc), true),
            new SeedEmployee("Alex", "Kumar", "alex.kumar@ey-hr.com", "Engineering", "Junior Software Engineer", "ENG-FRONTEND", "james.wilson@ey-hr.com", new DateTime(2024, 2, 1, 0, 0, 0, DateTimeKind.Utc), true),
            new SeedEmployee("Emma", "Rodriguez", "emma.rodriguez@ey-hr.com", "Human Resources", "HR Specialist", "HR-OPS", "maria.garcia@ey-hr.com", new DateTime(2023, 5, 20, 0, 0, 0, DateTimeKind.Utc), true),
            new SeedEmployee("David", "Kim", "david.kim@ey-hr.com", "Finance", "Financial Analyst", null, "lisa.brown@ey-hr.com", new DateTime(2023, 8, 20, 0, 0, 0, DateTimeKind.Utc), true),
            new SeedEmployee("Emily", "Johnson", "emily.johnson@ey-hr.com", "Marketing", "Marketing Specialist", null, "michael.lee@ey-hr.com", new DateTime(2022, 2, 14, 0, 0, 0, DateTimeKind.Utc), true),
            new SeedEmployee("John", "Smith", "john.smith@ey-hr.com", "Engineering", "Software Engineer", "ENG-BACKEND", "james.wilson@ey-hr.com", new DateTime(2020, 1, 10, 0, 0, 0, DateTimeKind.Utc), false),
        };

        var employees = seedEmployees
            .Select(seed => Employee.Create(tenantId, seed.FirstName, seed.LastName, seed.Email, seed.Department))
            .ToList();

        await db.Employees.AddRangeAsync(employees);
        await db.SaveChangesAsync();

        var employeesByEmail = employees.ToDictionary(employee => employee.Email, StringComparer.OrdinalIgnoreCase);

        var employments = new List<Employment>();
        var assignmentsByEmail = new Dictionary<string, WorkAssignment>(StringComparer.OrdinalIgnoreCase);

        foreach (var seed in seedEmployees)
        {
            var employee = employeesByEmail[seed.Email];
            var employment = Employment.Start(
                tenantId,
                employee.Id,
                seed.HireDate,
                "FullTime",
                WorkforceSourceType.Manual,
                sourceReference: "CoreHRSeeder");

            if (!seed.IsActive)
            {
                employment.End(new DateTime(2024, 1, 10, 0, 0, 0, DateTimeKind.Utc));
            }

            employments.Add(employment);

            if (seed.OrgUnitCode is not null && orgUnits.TryGetValue(seed.OrgUnitCode, out var orgUnit))
            {
                assignmentsByEmail[seed.Email] = WorkAssignment.Create(
                    tenantId,
                    employment.Id,
                    employee.Id,
                    orgUnit.Id,
                    seed.JobTitle,
                    null,
                    isPrimary: true,
                    effectiveFrom: seed.HireDate,
                    effectiveTo: employment.EffectiveTo,
                    source: WorkforceSourceType.Manual,
                    sourceReference: "CoreHRSeeder");
            }
        }

        await db.Employments.AddRangeAsync(employments);
        await db.WorkAssignments.AddRangeAsync(assignmentsByEmail.Values);

        var relationships = new List<ManagerRelationship>();
        foreach (var seed in seedEmployees.Where(seed => seed.ManagerEmail is not null))
        {
            if (!assignmentsByEmail.TryGetValue(seed.Email, out var subjectAssignment)
                || !assignmentsByEmail.TryGetValue(seed.ManagerEmail!, out var managerAssignment))
            {
                continue;
            }

            relationships.Add(ManagerRelationship.Create(
                tenantId,
                subjectAssignment.EmployeeId,
                managerAssignment.EmployeeId,
                subjectAssignment.Id,
                managerAssignment.Id,
                ReportingRelationshipType.PrimaryManager,
                seed.HireDate,
                WorkforceSourceType.Manual,
                effectiveTo: employments.First(current => current.EmployeeId == subjectAssignment.EmployeeId).EffectiveTo,
                sourceReference: "CoreHRSeeder"));
        }

        await db.ManagerRelationships.AddRangeAsync(relationships);

        await db.SaveChangesAsync();
    }

    private sealed record SeedEmployee(
        string FirstName,
        string LastName,
        string Email,
        string? Department,
        string JobTitle,
        string? OrgUnitCode,
        string? ManagerEmail,
        DateTime HireDate,
        bool IsActive);
}

using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence;

/// <summary>
/// Seeds demo employee data for development and testing.
/// Uses a well-known tenant ID that should match the tenant_id claim in test tokens.
/// </summary>
public static class CoreHRSeeder
{
    // Well-known tenant ID for demo/dev purposes
    // This must match the tenant_id claim assigned to the admin user in Identity
    public static readonly Guid DemoTenantId = new("019d0000-0000-7000-0000-000000000001");

    public static async Task SeedAsync(CoreHRDbContext db)
    {
        // Idempotent: skip if employees already exist
        if (await db.Employees.AnyAsync())
            return;

        var now = DateTime.UtcNow;

        // Create employees without managers first
        var vpEng = Employee.Create(
            DemoTenantId,
            "Robert", "Taylor",
            "robert.taylor@ey-hr.com",
            new DateTime(2018, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            "Engineering", "VP of Engineering");

        var hrDirector = Employee.Create(
            DemoTenantId,
            "Maria", "Garcia",
            "maria.garcia@ey-hr.com",
            new DateTime(2021, 3, 10, 0, 0, 0, DateTimeKind.Utc),
            "Human Resources", "HR Director");

        var financeDirector = Employee.Create(
            DemoTenantId,
            "Lisa", "Brown",
            "lisa.brown@ey-hr.com",
            new DateTime(2020, 11, 1, 0, 0, 0, DateTimeKind.Utc),
            "Finance", "Finance Director");

        var marketingDirector = Employee.Create(
            DemoTenantId,
            "Michael", "Lee",
            "michael.lee@ey-hr.com",
            new DateTime(2019, 7, 15, 0, 0, 0, DateTimeKind.Utc),
            "Marketing", "Marketing Director");

        // Save directors first to get IDs
        await db.Employees.AddRangeAsync(vpEng, hrDirector, financeDirector, marketingDirector);
        await db.SaveChangesAsync();

        // Create tech lead reporting to VP
        var techLead = Employee.Create(
            DemoTenantId,
            "James", "Wilson",
            "james.wilson@ey-hr.com",
            new DateTime(2022, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            "Engineering", "Tech Lead");
        techLead.AssignManager(vpEng.Id);

        // Create employees with managers
        var seniorDev = Employee.Create(
            DemoTenantId,
            "Sarah", "Chen",
            "sarah.chen@ey-hr.com",
            new DateTime(2023, 1, 15, 0, 0, 0, DateTimeKind.Utc),
            "Engineering", "Senior Software Engineer");
        
        var juniorDev = Employee.Create(
            DemoTenantId,
            "Alex", "Kumar",
            "alex.kumar@ey-hr.com",
            new DateTime(2024, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            "Engineering", "Junior Software Engineer");

        var hrSpecialist = Employee.Create(
            DemoTenantId,
            "Emma", "Rodriguez",
            "emma.rodriguez@ey-hr.com",
            new DateTime(2023, 5, 20, 0, 0, 0, DateTimeKind.Utc),
            "Human Resources", "HR Specialist");
        hrSpecialist.AssignManager(hrDirector.Id);

        var financialAnalyst = Employee.Create(
            DemoTenantId,
            "David", "Kim",
            "david.kim@ey-hr.com",
            new DateTime(2023, 8, 20, 0, 0, 0, DateTimeKind.Utc),
            "Finance", "Financial Analyst");
        financialAnalyst.AssignManager(financeDirector.Id);

        var marketingSpecialist = Employee.Create(
            DemoTenantId,
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
            DemoTenantId,
            "John", "Smith",
            "john.smith@ey-hr.com",
            new DateTime(2020, 1, 10, 0, 0, 0, DateTimeKind.Utc),
            "Engineering", "Software Engineer");
        formerEmployee.AssignManager(techLead.Id);
        formerEmployee.Deactivate();

        await db.Employees.AddAsync(formerEmployee);
        await db.SaveChangesAsync();
    }
}

using System.Text.Json;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.DemoSeed;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence;

/// <summary>
/// Seeds the single canonical Development tenant. CoreHR owns the workforce truth used by
/// Identity and Performance; no downstream service creates employee records.
/// </summary>
public static class CoreHRSeeder
{
    private static readonly Guid SeederActorId = Guid.Parse("00000000-0000-0000-0000-000000000099");
    private const string SeederDisplayName = "Canonical Demo Seeder";
    private const string SourceReference = "canonical-fusion-tenant-v1";

    public static async Task ResetAsync(CoreHRDbContext dbContext, Guid tenantId, CancellationToken cancellationToken = default)
    {
        if (tenantId != CanonicalDemoSeed.TenantId)
            throw new InvalidOperationException("Canonical CoreHR reset is restricted to the configured demo tenant.");

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        await CanonicalTenantResetter.ResetAsync(dbContext, tenantId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public static async Task SeedAsync(CoreHRDbContext dbContext, Guid tenantId, CancellationToken cancellationToken = default)
    {
        if (tenantId != CanonicalDemoSeed.TenantId)
            throw new InvalidOperationException("Canonical CoreHR seeding is restricted to the configured demo tenant.");

        CanonicalManifestValidator.EnsureValid(CanonicalDemoSeed.BuildOrgUnits(), CanonicalDemoSeed.BuildEmployees(), tenantId);
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var existingEmployeeCount = await dbContext.Employees.IgnoreQueryFilters()
            .CountAsync(employee => employee.TenantId == tenantId);
        if (existingEmployeeCount > 0)
        {
            if (existingEmployeeCount != 320)
                throw new InvalidOperationException(
                    $"Canonical CoreHR data is partial: expected 320 employees, found {existingEmployeeCount}. Run the canonical fresh reset.");

            var expectedIds = CanonicalDemoSeed.BuildEmployees().Select(employee => employee.Id).ToHashSet();
            var actualIds = await dbContext.Employees.IgnoreQueryFilters()
                .Where(employee => employee.TenantId == tenantId)
                .Select(employee => employee.Id)
                .ToListAsync();
            if (!expectedIds.SetEquals(actualIds))
                throw new InvalidOperationException("Canonical CoreHR employee IDs drifted from the manifest. Run the canonical fresh reset.");

            await WriteReceiptAsync(dbContext, tenantId);
            await transaction.CommitAsync(cancellationToken);
            return;
        }

        await SeedSetupStateAsync(dbContext, tenantId);
        await SeedTenantSettingsAsync(dbContext, tenantId);
        var orgUnits = await SeedOrgUnitsAsync(dbContext, tenantId);
        await SeedEmployeesAsync(dbContext, tenantId, orgUnits);
        await WriteReceiptAsync(dbContext, tenantId);
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task SeedSetupStateAsync(CoreHRDbContext dbContext, Guid tenantId)
    {
        if (await dbContext.TenantSetupStates.IgnoreQueryFilters().AnyAsync(state => state.TenantId == tenantId))
            return;

        var setupState = TenantSetupState.CreateActivated(tenantId);
        setupState.Approve(SeederActorId, SeederDisplayName, PlatformRole.PlatformAdmin, isPlatformAssisted: true);
        setupState.Publish();
        dbContext.TenantSetupStates.Add(setupState);
        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedTenantSettingsAsync(CoreHRDbContext dbContext, Guid tenantId)
    {
        if (await dbContext.TenantSettings.IgnoreQueryFilters().AnyAsync(settings => settings.TenantId == tenantId))
            return;

        dbContext.TenantSettings.Add(TenantSettings.Create(tenantId, JsonSerializer.Serialize(new
        {
            locale = "en-TN",
            timeZone = "Africa/Tunis",
            currency = "TND",
            orgUnitTypes = new[] { "Department", "Team" }
        })));
        await dbContext.SaveChangesAsync();
    }

    private static async Task<Dictionary<string, OrgUnit>> SeedOrgUnitsAsync(
        CoreHRDbContext dbContext,
        Guid tenantId)
    {
        var existing = await dbContext.OrgUnits.IgnoreQueryFilters()
            .Where(unit => unit.TenantId == tenantId)
            .ToListAsync();
        if (existing.Count > 0)
        {
            if (existing.Count != 40)
                throw new InvalidOperationException($"Canonical CoreHR organization is partial: expected 40 units, found {existing.Count}.");
            return existing.ToDictionary(unit => unit.Code, StringComparer.OrdinalIgnoreCase);
        }

        var specs = CanonicalDemoSeed.BuildOrgUnits();
        var byCode = new Dictionary<string, OrgUnit>(StringComparer.OrdinalIgnoreCase);
        foreach (var spec in specs.Where(spec => spec.ParentCode is null))
        {
            var unit = OrgUnit.CreateSeeded(spec.Id, tenantId, spec.Code, spec.Name, spec.Type, null);
            byCode[spec.Code] = unit;
            dbContext.OrgUnits.Add(unit);
        }
        await dbContext.SaveChangesAsync();

        foreach (var spec in specs.Where(spec => spec.ParentCode is not null))
        {
            var unit = OrgUnit.CreateSeeded(
                spec.Id,
                tenantId,
                spec.Code,
                spec.Name,
                spec.Type,
                byCode[spec.ParentCode!].Id);
            byCode[spec.Code] = unit;
            dbContext.OrgUnits.Add(unit);
        }
        await dbContext.SaveChangesAsync();
        return byCode;
    }

    private static async Task SeedEmployeesAsync(
        CoreHRDbContext dbContext,
        Guid tenantId,
        IReadOnlyDictionary<string, OrgUnit> orgUnits)
    {
        var specs = CanonicalDemoSeed.BuildEmployees();
        var employees = specs.Select(spec => Employee.CreateSeeded(
            spec.Id,
            tenantId,
            spec.FirstName,
            spec.LastName,
            spec.Email,
            spec.Department,
            spec.EmployeeNumber,
            phone: $"+216 70 {spec.EmployeeNumber[^4..]}"))
            .ToList();
        dbContext.Employees.AddRange(employees);
        await dbContext.SaveChangesAsync();

        var employmentsByEmployeeId = new Dictionary<Guid, Employment>();
        var assignmentsByEmployeeId = new Dictionary<Guid, WorkAssignment>();
        var employments = new List<Employment>(specs.Count);
        var assignments = new List<WorkAssignment>(specs.Count);

        foreach (var spec in specs)
        {
            var employment = Employment.Start(
                tenantId,
                spec.Id,
                spec.HireDate,
                spec.EmploymentType,
                WorkforceSourceType.Manual,
                SourceReference);
            if (!spec.IsActive)
                employment.End(spec.EndDate!.Value);

            var assignment = WorkAssignment.Create(
                tenantId,
                employment.Id,
                spec.Id,
                orgUnits[spec.OrgUnitCode].Id,
                spec.JobTitle,
                spec.WorkLocation,
                isPrimary: true,
                effectiveFrom: spec.HireDate,
                effectiveTo: employment.EffectiveTo,
                source: WorkforceSourceType.Manual,
                sourceReference: SourceReference);

            employments.Add(employment);
            assignments.Add(assignment);
            employmentsByEmployeeId[spec.Id] = employment;
            assignmentsByEmployeeId[spec.Id] = assignment;
        }

        dbContext.Employments.AddRange(employments);
        dbContext.WorkAssignments.AddRange(assignments);
        await dbContext.SaveChangesAsync();

        var relationships = specs
            .Where(spec => spec.ManagerId is not null && assignmentsByEmployeeId.ContainsKey(spec.ManagerId.Value))
            .Select(spec => ManagerRelationship.Create(
                tenantId,
                spec.Id,
                spec.ManagerId!.Value,
                assignmentsByEmployeeId[spec.Id].Id,
                assignmentsByEmployeeId[spec.ManagerId.Value].Id,
                ReportingRelationshipType.PrimaryManager,
                spec.HireDate,
                WorkforceSourceType.Manual,
                effectiveTo: employmentsByEmployeeId[spec.Id].EffectiveTo,
                sourceReference: SourceReference))
            .ToList();

        dbContext.ManagerRelationships.AddRange(relationships);
        await dbContext.SaveChangesAsync();
        await WriteReceiptAsync(dbContext, tenantId);
    }

    private static async Task WriteReceiptAsync(CoreHRDbContext dbContext, Guid tenantId)
    {
        var receipt = await dbContext.CanonicalSeedReceipts.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.TenantId == tenantId);
        if (receipt is null)
            dbContext.CanonicalSeedReceipts.Add(CanonicalSeedReceipt.Create(tenantId, CanonicalDemoSeed.AsOfUtc));
        else
        {
            if (receipt.ManifestHash != CanonicalDemoSeed.ManifestHash)
                throw new InvalidOperationException("Canonical CoreHR seed receipt drifted from the manifest. Run the canonical fresh reset.");
            receipt.Refresh(CanonicalDemoSeed.AsOfUtc);
        }
        await dbContext.SaveChangesAsync();
    }
}

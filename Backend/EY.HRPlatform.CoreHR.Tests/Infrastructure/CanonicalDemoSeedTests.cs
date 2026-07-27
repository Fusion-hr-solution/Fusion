using EY.HRPlatform.DemoSeed;

namespace EY.HRPlatform.CoreHR.Tests.Infrastructure;

public sealed class CanonicalDemoSeedTests
{
    [Fact]
    public void Builds_the_documented_workforce_shape()
    {
        var employees = CanonicalDemoSeed.BuildEmployees();

        Assert.Equal(320, employees.Count);
        Assert.Equal(300, employees.Count(employee => employee.IsActive));
        Assert.Equal(20, employees.Count(employee => !employee.IsActive));
        Assert.Equal(320, employees.Select(employee => employee.Id).Distinct().Count());
        Assert.Equal(8, CanonicalDemoSeed.BuildOrgUnits().Count(unit => unit.Type == "Department"));
        Assert.Equal(32, CanonicalDemoSeed.BuildOrgUnits().Count(unit => unit.Type == "Team"));
    }

    [Fact]
    public void Keeps_lifecycle_personas_and_manager_links_deterministic()
    {
        var employees = CanonicalDemoSeed.BuildEmployees();

        Assert.Equal(CanonicalDemoSeed.DirectorId, CanonicalDemoSeed.GetEmployeeByEmail("flit.manager@atlas.example").Id);
        Assert.Equal(CanonicalDemoSeed.LifecycleEmployeeIds[1], CanonicalDemoSeed.GetEmployeeByEmail("yassine.draft@atlas.example").Id);
        Assert.All(employees.Where(employee => employee.Id != CanonicalDemoSeed.DirectorId), employee =>
        {
            Assert.NotNull(employee.ManagerId);
            Assert.Contains(employees, manager => manager.Id == employee.ManagerId);
        });
    }

    [Fact]
    public void Rejects_duplicate_and_missing_references()
    {
        var orgUnits = CanonicalDemoSeed.BuildOrgUnits().ToList();
        var employees = CanonicalDemoSeed.BuildEmployees().ToList();
        orgUnits.Add(orgUnits[0] with { Code = orgUnits[1].Code, Id = orgUnits[1].Id });
        employees[1] = employees[1] with { ManagerId = Guid.NewGuid() };

        var errors = CanonicalManifestValidator.Validate(orgUnits, employees, CanonicalDemoSeed.TenantId);

        Assert.Contains(errors, error => error.Contains("Duplicate org-unit code", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("missing manager", StringComparison.Ordinal));
    }

    [Fact]
    public void Rejects_tenant_and_population_mismatches()
    {
        var employees = CanonicalDemoSeed.BuildEmployees().Take(319).ToList();

        var errors = CanonicalManifestValidator.Validate(
            CanonicalDemoSeed.BuildOrgUnits(), employees, Guid.NewGuid());

        Assert.Contains(errors, error => error.Contains("tenant", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(errors, error => error.Contains("expected 320", StringComparison.Ordinal));
    }
}

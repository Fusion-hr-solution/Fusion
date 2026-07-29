namespace EY.HRPlatform.DemoSeed;

public static class CanonicalManifestValidator
{
    public static IReadOnlyList<string> Validate(
        IReadOnlyList<DemoOrgUnitSpec> orgUnits,
        IReadOnlyList<DemoEmployeeSpec> employees,
        Guid tenantId,
        int expectedEmployees = 320,
        int expectedActiveEmployees = 300,
        int expectedEndedEmployees = 20,
        int expectedDepartments = 8,
        int expectedTeams = 32)
    {
        var errors = new List<string>();
        if (tenantId == Guid.Empty || tenantId != CanonicalDemoSeed.TenantId)
            errors.Add("Manifest tenant does not match the canonical tenant.");

        AddDuplicateErrors(errors, orgUnits.Select(unit => unit.Code), "org-unit code");
        AddDuplicateErrors(errors, orgUnits.Select(unit => unit.Id), "org-unit id");
        AddDuplicateErrors(errors, employees.Select(employee => employee.EmployeeNumber), "employee number");
        AddDuplicateErrors(errors, employees.Select(employee => employee.Email), "employee email");
        AddDuplicateErrors(errors, employees.Select(employee => employee.Id), "employee id");

        var orgCodes = orgUnits.Select(unit => unit.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var unit in orgUnits.Where(unit => unit.ParentCode is not null))
        {
            if (!orgCodes.Contains(unit.ParentCode!))
                errors.Add($"Org unit '{unit.Code}' references missing parent '{unit.ParentCode}'.");
            if (string.Equals(unit.Code, unit.ParentCode, StringComparison.OrdinalIgnoreCase))
                errors.Add($"Org unit '{unit.Code}' cannot be its own parent.");
        }

        var employeeIds = employees.Select(employee => employee.Id).ToHashSet();
        foreach (var employee in employees.Where(employee => employee.ManagerId is not null))
        {
            if (!employeeIds.Contains(employee.ManagerId!.Value))
                errors.Add($"Employee '{employee.EmployeeNumber}' references a missing manager.");
            if (employee.ManagerId == employee.Id)
                errors.Add($"Employee '{employee.EmployeeNumber}' cannot manage itself.");
        }

        var active = employees.Count(employee => employee.IsActive);
        var ended = employees.Count(employee => !employee.IsActive);
        if (employees.Count != expectedEmployees)
            errors.Add($"Employee count is {employees.Count}; expected {expectedEmployees}.");
        if (active != expectedActiveEmployees)
            errors.Add($"Active employee count is {active}; expected {expectedActiveEmployees}.");
        if (ended != expectedEndedEmployees)
            errors.Add($"Ended employee count is {ended}; expected {expectedEndedEmployees}.");
        if (orgUnits.Count(unit => unit.Type.Equals("Department", StringComparison.OrdinalIgnoreCase)) != expectedDepartments)
            errors.Add("Department count does not match the manifest.");
        if (orgUnits.Count(unit => unit.Type.Equals("Team", StringComparison.OrdinalIgnoreCase)) != expectedTeams)
            errors.Add("Team count does not match the manifest.");

        return errors;
    }

    public static void EnsureValid(
        IReadOnlyList<DemoOrgUnitSpec> orgUnits,
        IReadOnlyList<DemoEmployeeSpec> employees,
        Guid tenantId)
    {
        var errors = Validate(orgUnits, employees, tenantId);
        if (errors.Count > 0)
            throw new InvalidOperationException($"Canonical manifest is invalid: {string.Join(" ", errors)}");
    }

    private static void AddDuplicateErrors<T>(ICollection<string> errors, IEnumerable<T> values, string label)
    {
        foreach (var duplicate in values.GroupBy(value => value).Where(group => group.Count() > 1))
            errors.Add($"Duplicate {label} '{duplicate.Key}'.");
    }
}

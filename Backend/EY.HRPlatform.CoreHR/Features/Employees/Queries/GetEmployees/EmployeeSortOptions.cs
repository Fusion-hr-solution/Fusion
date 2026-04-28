namespace EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployees;

/// <summary>
/// Sort field options for employee directory queries.
/// </summary>
public enum EmployeeSortField
{
    /// <summary>Sort by last name, then first name.</summary>
    Name,
    /// <summary>Sort by email address.</summary>
    Email,
    /// <summary>Sort by hire date.</summary>
    HireDate,
    /// <summary>Sort by employee status.</summary>
    Status
}

/// <summary>
/// Sort direction for employee directory queries.
/// </summary>
public enum SortDirection
{
    /// <summary>Ascending order (A-Z, oldest first).</summary>
    Asc,
    /// <summary>Descending order (Z-A, newest first).</summary>
    Desc
}

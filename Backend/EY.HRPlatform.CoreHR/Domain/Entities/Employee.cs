using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class Employee : AggregateRoot, ITenantEntity
{
    private Employee() { }

    public Guid TenantId { get; private set; }

    /// <summary>
    /// Row version for optimistic concurrency control (mapped to PostgreSQL xmin).
    /// </summary>
    public uint Version { get; private set; }
    public string? EmployeeNumber { get; private set; }
    public string FirstName { get; private set; } = string.Empty;
    public string LastName { get; private set; } = string.Empty;
    public string? PreferredName { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string? Department { get; private set; }
    public string? JobTitle { get; private set; }
    public DateTime HireDate { get; private set; }
    public EmployeeStatus Status { get; private set; }
    public Guid? ManagerId { get; private set; }
    public Employee? Manager { get; private set; }
    public Guid? OrgUnitId { get; private set; }
    public OrgUnit? OrgUnit { get; private set; }

    public string FullName => $"{FirstName} {LastName}";
    public string DisplayName => !string.IsNullOrWhiteSpace(PreferredName)
        ? $"{PreferredName} {LastName}"
        : FullName;

    public static Employee Create(
        Guid tenantId,
        string firstName,
        string lastName,
        string email,
        DateTime hireDate,
        string? department = null,
        string? jobTitle = null,
        string? employeeNumber = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        if (string.IsNullOrWhiteSpace(firstName))
            throw new ArgumentException("First name cannot be empty.", nameof(firstName));

        if (string.IsNullOrWhiteSpace(lastName))
            throw new ArgumentException("Last name cannot be empty.", nameof(lastName));

        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email cannot be empty.", nameof(email));

        hireDate = NormalizeHireDate(hireDate, nameof(hireDate));

        return new Employee
        {
            TenantId = tenantId,
            EmployeeNumber = NormalizeEmployeeNumber(employeeNumber),
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            Email = email.Trim().ToLowerInvariant(),
            HireDate = hireDate,
            Department = department?.Trim(),
            JobTitle = jobTitle?.Trim(),
            Status = EmployeeStatus.Active
        };
    }

    public void Activate()
    {
        if (Status == EmployeeStatus.Active)
            throw new InvalidOperationException("Employee is already active.");

        Status = EmployeeStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        if (Status == EmployeeStatus.Inactive)
            throw new InvalidOperationException("Employee is already inactive.");

        Status = EmployeeStatus.Inactive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDetails(
        string firstName,
        string lastName,
        string email,
        string? department,
        string? jobTitle,
        string? employeeNumber = null)
    {
        if (string.IsNullOrWhiteSpace(firstName))
            throw new ArgumentException("First name cannot be empty.", nameof(firstName));

        if (string.IsNullOrWhiteSpace(lastName))
            throw new ArgumentException("Last name cannot be empty.", nameof(lastName));

        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email cannot be empty.", nameof(email));

        EmployeeNumber = NormalizeEmployeeNumber(employeeNumber);
        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        Email = email.Trim().ToLowerInvariant();
        Department = department?.Trim();
        JobTitle = jobTitle?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateHireDate(DateTime hireDate)
    {
        HireDate = NormalizeHireDate(hireDate, nameof(hireDate));
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdatePreferredName(string? preferredName)
    {
        PreferredName = NormalizePreferredName(preferredName);
        UpdatedAt = DateTime.UtcNow;
    }

    public void AssignManager(Guid? managerId)
    {
        if (managerId == Guid.Empty)
            managerId = null;

        if (managerId == Id)
            throw new ArgumentException("Employee cannot be their own manager.", nameof(managerId));

        ManagerId = managerId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AssignOrgUnit(Guid? orgUnitId)
    {
        if (orgUnitId == Guid.Empty)
            orgUnitId = null;

        OrgUnitId = orgUnitId;
        UpdatedAt = DateTime.UtcNow;
    }

    private static DateTime NormalizeHireDate(DateTime hireDate, string paramName)
    {
        if (hireDate == default)
            throw new ArgumentException("HireDate must be a valid date.", paramName);

        return hireDate.Kind switch
        {
            DateTimeKind.Utc => hireDate,
            DateTimeKind.Local => hireDate.ToUniversalTime(),
            _ => throw new ArgumentException(
                "HireDate must have DateTimeKind.Utc or DateTimeKind.Local; Unspecified is not allowed.",
                paramName)
        };
    }

    private static string? NormalizePreferredName(string? preferredName)
    {
        if (string.IsNullOrWhiteSpace(preferredName))
            return null;

        return preferredName.Trim();
    }

    private static string? NormalizeEmployeeNumber(string? employeeNumber)
    {
        if (string.IsNullOrWhiteSpace(employeeNumber))
            return null;

        var normalized = employeeNumber.Trim().ToUpperInvariant();
        if (normalized.Length > 64)
        {
            throw new ArgumentException("EmployeeNumber cannot exceed 64 characters.", nameof(employeeNumber));
        }

        return normalized;
    }
}

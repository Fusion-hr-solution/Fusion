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
    public string StableEmployeeKey { get; private set; } = string.Empty;
    public string FirstName { get; private set; } = string.Empty;
    public string LastName { get; private set; } = string.Empty;
    public string? PreferredName { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string? Phone { get; private set; }
    public string? Department { get; private set; }
    public string FullName => $"{FirstName} {LastName}";
    public string DisplayName => !string.IsNullOrWhiteSpace(PreferredName)
        ? $"{PreferredName} {LastName}"
        : FullName;

    public static Employee Create(
        Guid tenantId,
        string firstName,
        string lastName,
        string email,
        string? department = null,
        string? employeeNumber = null,
        string? phone = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        if (string.IsNullOrWhiteSpace(firstName))
            throw new ArgumentException("First name cannot be empty.", nameof(firstName));

        if (string.IsNullOrWhiteSpace(lastName))
            throw new ArgumentException("Last name cannot be empty.", nameof(lastName));

        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email cannot be empty.", nameof(email));

        var id = Guid.NewGuid();
        return new Employee
        {
            Id = id,
            TenantId = tenantId,
            EmployeeNumber = NormalizeEmployeeNumber(employeeNumber),
            StableEmployeeKey = GenerateStableKey(id),
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            Email = email.Trim().ToLowerInvariant(),
            Phone = NormalizePhone(phone),
            Department = department?.Trim()
        };
    }

    public static Employee Create(
        Guid tenantId,
        string firstName,
        string lastName,
        string email,
        DateTime hireDate,
        string? department = null,
        string? jobTitle = null,
        string? employeeNumber = null,
        string? phone = null,
        string? workLocation = null,
        string? employmentType = null)
        => Create(
            tenantId,
            firstName,
            lastName,
            email,
            department,
            employeeNumber,
            phone);

    /// <summary>
    /// Updates Core-owned identity/profile facts only (name, email, phone, preferred name).
    /// Workforce facts (job title, organization, manager, employment type/state) are owned by
    /// the canonical <c>Employment</c>/<c>WorkAssignment</c>/<c>ManagerRelationship</c> chain and
    /// are never written through this method.
    /// </summary>
    public void UpdateProfile(
        string firstName,
        string lastName,
        string email,
        string? preferredName,
        string? phone)
    {
        if (string.IsNullOrWhiteSpace(firstName))
            throw new ArgumentException("First name cannot be empty.", nameof(firstName));

        if (string.IsNullOrWhiteSpace(lastName))
            throw new ArgumentException("Last name cannot be empty.", nameof(lastName));

        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email cannot be empty.", nameof(email));

        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        Email = email.Trim().ToLowerInvariant();
        PreferredName = NormalizePreferredName(preferredName);
        Phone = NormalizePhone(phone);
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdatePreferredName(string? preferredName)
    {
        PreferredName = NormalizePreferredName(preferredName);
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdatePhone(string? phone)
    {
        Phone = NormalizePhone(phone);
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateEmployeeNumber(string? employeeNumber)
    {
        EmployeeNumber = NormalizeEmployeeNumber(employeeNumber);
        UpdatedAt = DateTime.UtcNow;
    }

    private static string? NormalizePreferredName(string? preferredName)
    {
        if (string.IsNullOrWhiteSpace(preferredName))
            return null;

        return preferredName.Trim();
    }

    private static string GenerateStableKey(Guid id)
    {
        var shortId = id.ToString("N")[..8].ToUpperInvariant();
        return $"E-{shortId}";
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

    private static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return null;

        var normalized = phone.Trim();
        if (normalized.Length > 50)
        {
            throw new ArgumentException("Phone cannot exceed 50 characters.", nameof(phone));
        }

        return normalized;
    }

}

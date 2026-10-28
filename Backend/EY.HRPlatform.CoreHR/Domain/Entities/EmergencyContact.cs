using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>Someone to call for an employee in an emergency. Owned by <see cref="Employee"/>, which keeps at most three.</summary>
public sealed class EmergencyContact : BaseEntity, ITenantEntity
{
    private EmergencyContact() { }

    public Guid TenantId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Relationship { get; private set; }
    public string Phone { get; private set; } = string.Empty;

    /// <summary>The order the employee listed them in, from 0.</summary>
    public int Position { get; private set; }

    internal static EmergencyContact Create(Guid tenantId, Guid employeeId, int position, EmergencyContactDetails details)
        => new()
        {
            TenantId = tenantId,
            EmployeeId = employeeId,
            Position = position,
            Name = details.Name,
            Relationship = details.Relationship,
            Phone = details.Phone,
        };

    internal EmergencyContactDetails ToDetails() => new(Name, Relationship, Phone);
}

/// <summary>An emergency contact as entered: a name and a phone, and optionally how they are related.</summary>
public sealed record EmergencyContactDetails(string Name, string? Relationship, string Phone)
{
    public static EmergencyContactDetails Normalize(string? name, string? relationship, string? phone)
    {
        var trimmedName = name?.Trim();
        var trimmedPhone = phone?.Trim();
        if (string.IsNullOrEmpty(trimmedName))
            throw new ArgumentException("Each emergency contact needs a name.", nameof(name));
        if (trimmedName.Length > 200)
            throw new ArgumentException("An emergency contact's name cannot exceed 200 characters.", nameof(name));
        if (string.IsNullOrEmpty(trimmedPhone))
            throw new ArgumentException("Each emergency contact needs a phone number.", nameof(phone));
        if (trimmedPhone.Length > 50)
            throw new ArgumentException("An emergency contact's phone cannot exceed 50 characters.", nameof(phone));
        var trimmedRelationship = string.IsNullOrWhiteSpace(relationship) ? null : relationship.Trim();
        if (trimmedRelationship?.Length > 60)
            throw new ArgumentException("A relationship cannot exceed 60 characters.", nameof(relationship));
        return new EmergencyContactDetails(trimmedName, trimmedRelationship, trimmedPhone);
    }
}

/// <summary>A home address; every part is optional, and an address with no parts is no address.</summary>
public sealed record HomeAddress(string? Street, string? City, string? PostalCode, string? Country)
{
    public bool IsEmpty => Street is null && City is null && PostalCode is null && Country is null;
}

/// <summary>Everything on the Personal tab that the employee or HR can change, in one replacement.</summary>
public sealed record PersonalDetails(
    string? PreferredName,
    string? Mobile,
    string? PersonalEmail,
    HomeAddress? HomeAddress,
    DateOnly? DateOfBirth,
    IReadOnlyList<EmergencyContactDetails> EmergencyContacts);

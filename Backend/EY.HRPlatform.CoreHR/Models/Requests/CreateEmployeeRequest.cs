using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Models.Requests;

/// <summary>
/// Request body for creating a new employee.
/// </summary>
public sealed record CreateEmployeeRequest(
    [StringLength(64)] string? EmployeeNumber,
    [Required] string FirstName,
    [Required] string LastName,
    [EmailAddress] string? Email,
    [Required] DateTime HireDate,
    [StringLength(50)] string? Phone = null,
    [StringLength(100)] string? JobTitle = null,
    [StringLength(100)] string? WorkLocation = null,
    [StringLength(50)] string? EmploymentType = null,
    Guid? ManagerId = null,
    Guid? OrgUnitId = null);

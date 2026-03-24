using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Models.Requests;

/// <summary>
/// Request body for creating a new employee.
/// </summary>
public sealed record CreateEmployeeRequest(
    [Required] string FirstName,
    [Required] string LastName,
    [Required, EmailAddress] string Email,
    [Required] DateTime HireDate,
    string? Department = null,
    string? JobTitle = null,
    Guid? ManagerId = null);

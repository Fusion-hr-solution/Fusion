using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Models.Requests;

/// <summary>
/// Request body for updating an existing employee.
/// </summary>
public sealed record UpdateEmployeeRequest(
    [Required] string FirstName,
    [Required] string LastName,
    [Required, EmailAddress] string Email,
    string? Department,
    string? JobTitle,
    Guid? ManagerId);

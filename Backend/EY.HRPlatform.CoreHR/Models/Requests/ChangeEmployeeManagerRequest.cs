using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Models.Requests;

/// <summary>Request body for changing an employee's primary manager effective a given date.</summary>
public sealed record ChangeEmployeeManagerRequest(
    [Required] Guid ManagerId,
    [Required] DateTime EffectiveDate);

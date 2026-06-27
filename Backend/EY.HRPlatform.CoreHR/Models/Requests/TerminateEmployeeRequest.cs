using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Models.Requests;

/// <summary>Request body for terminating an employee effective a given date.</summary>
public sealed record TerminateEmployeeRequest(
    [Required] DateTime EffectiveDate,
    [StringLength(250)] string? Note = null);

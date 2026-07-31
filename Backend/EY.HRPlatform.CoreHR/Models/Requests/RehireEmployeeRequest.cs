using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Models.Requests;

/// <summary>Request body for rehiring a previously employed worker effective a given date.</summary>
public sealed record RehireEmployeeRequest(
    [Required] DateTime EffectiveDate,
    [Required] Guid OrgUnitId,
    [Required, StringLength(100)] string JobTitle,
    [StringLength(100)] string? WorkLocation = null,
    Guid? ManagerId = null,
    [StringLength(50)] string? EmploymentType = null);

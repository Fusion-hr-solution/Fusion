using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Models.Requests;

public sealed record UpdateOwnEmployeeProfileRequest(
    [StringLength(100)] string? PreferredName);

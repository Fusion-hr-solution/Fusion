using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Models.Requests;

public sealed record UpdateMyProfileRequest(
    [StringLength(100)] string? PreferredName);
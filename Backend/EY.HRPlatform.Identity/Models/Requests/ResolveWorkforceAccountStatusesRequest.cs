using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Identity.Models.Requests;

public sealed class ResolveWorkforceAccountStatusesRequest
{
    [Required, MinLength(1)]
    public List<WorkforceAccountEmployeeSnapshotRequest> Employees { get; set; } = [];
}
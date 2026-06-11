using System.ComponentModel.DataAnnotations;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Models.Requests;

public sealed class BulkProvisionWorkforceAccountInvitesRequest
{
    [Required, MinLength(1)]
    public List<BulkProvisionWorkforceAccountInviteItemRequest> Items { get; set; } = [];
}

public sealed class BulkProvisionWorkforceAccountInviteItemRequest : WorkforceAccountEmployeeSnapshotRequest
{
    [Required]
    public string Role { get; set; } = PlatformRole.Employee;
}
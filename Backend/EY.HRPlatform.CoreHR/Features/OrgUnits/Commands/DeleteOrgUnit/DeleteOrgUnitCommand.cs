using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Commands.DeleteOrgUnit;

/// <summary>
/// Command to soft-delete an org unit.
/// </summary>
public sealed record DeleteOrgUnitCommand(
    Guid Id,
    uint ExpectedVersion) : ICommand<Result>;

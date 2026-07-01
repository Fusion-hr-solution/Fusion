using EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Commands.UpdateOrgUnit;

/// <summary>
/// Command to update an existing org unit.
/// Code is immutable after creation.
/// </summary>
public sealed record UpdateOrgUnitCommand(
    Guid Id,
    string Name,
    string Type,
    Guid? ParentId,
    uint ExpectedVersion,
    Guid? ResponsibleManagerEmployeeId = null) : ICommand<Result<OrgUnitDto>>;

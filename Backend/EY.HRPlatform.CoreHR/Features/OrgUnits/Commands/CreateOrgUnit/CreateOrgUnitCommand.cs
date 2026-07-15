using EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Commands.CreateOrgUnit;

/// <summary>
/// Command to create a new org unit within the current tenant.
/// </summary>
public sealed record CreateOrgUnitCommand(
    string Code,
    string Name,
    string Type,
    Guid? ParentId,
    Guid? ResponsibleManagerEmployeeId = null) : ICommand<Result<OrgUnitDto>>;

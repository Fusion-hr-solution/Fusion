using EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Queries.GetOrgUnitById;

/// <summary>
/// Query for retrieving a single org unit by ID.
/// </summary>
public record GetOrgUnitByIdQuery(Guid Id) : IQuery<Result<OrgUnitDto>>;

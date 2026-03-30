using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Queries.GetOrgUnitById;

public sealed class GetOrgUnitByIdQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetOrgUnitByIdQuery, Result<OrgUnitDto>>
{
    public async Task<Result<OrgUnitDto>> Handle(
        GetOrgUnitByIdQuery request,
        CancellationToken cancellationToken)
    {
        var orgUnit = await dbContext.OrgUnits
            .AsNoTracking()
            .Include(o => o.Parent)
            .FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);

        if (orgUnit is null)
        {
            throw new EntityNotFoundException("OrgUnit", request.Id);
        }

        return Result.Success(new OrgUnitDto(
            orgUnit.Id,
            orgUnit.Code,
            orgUnit.Name,
            orgUnit.Type,
            orgUnit.ParentId,
            orgUnit.Parent?.Name,
            orgUnit.IsActive,
            orgUnit.CreatedAt,
            orgUnit.UpdatedAt,
            orgUnit.Version));
    }
}

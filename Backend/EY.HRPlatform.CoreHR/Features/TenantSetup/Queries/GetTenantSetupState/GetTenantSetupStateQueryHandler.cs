using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Queries.GetTenantSetupState;

public sealed class GetTenantSetupStateQueryHandler(
    CoreHRDbContext dbContext) : IQueryHandler<GetTenantSetupStateQuery, TenantSetupStateDto>
{
    public async Task<TenantSetupStateDto> Handle(
        GetTenantSetupStateQuery request,
        CancellationToken cancellationToken)
    {
        var state = await dbContext.TenantSetupStates
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        return TenantSetupStateMapper.Map(state);
    }
}
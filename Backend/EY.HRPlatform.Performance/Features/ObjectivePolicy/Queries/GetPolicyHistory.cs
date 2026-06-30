using EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectivePolicy.Queries;

public sealed record GetPolicyHistoryQuery : IQuery<Result<IReadOnlyList<PolicyVersionDto>>>;

public sealed class GetPolicyHistoryQueryHandler(PerformanceDbContext db)
    : IQueryHandler<GetPolicyHistoryQuery, Result<IReadOnlyList<PolicyVersionDto>>>
{
    public async Task<Result<IReadOnlyList<PolicyVersionDto>>> Handle(
        GetPolicyHistoryQuery request,
        CancellationToken cancellationToken)
    {
        var versions = await db.TenantObjectivePolicyVersions
            .OrderByDescending(v => v.VersionNumber)
            .ToListAsync(cancellationToken);

        IReadOnlyList<PolicyVersionDto> result = versions.Select(GetPolicyQueryHandler.ToDto).ToList();
        return Result.Success(result);
    }
}

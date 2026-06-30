using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ObjectivePolicy.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.ObjectivePolicy.Queries;

public sealed record GetPolicyQuery : IQuery<Result<PolicySummaryDto>>;

public sealed class GetPolicyQueryHandler(PerformanceDbContext db)
    : IQueryHandler<GetPolicyQuery, Result<PolicySummaryDto>>
{
    public async Task<Result<PolicySummaryDto>> Handle(
        GetPolicyQuery request,
        CancellationToken cancellationToken)
    {
        var policy = await db.TenantObjectivePolicies
            .Include(p => p.Versions)
            .FirstOrDefaultAsync(cancellationToken);

        if (policy is null)
            return Result.Failure<PolicySummaryDto>(
                new Error("ObjectivePolicy.NotFound", "No objective policy has been configured for this tenant."));

        return new PolicySummaryDto(
            policy.Id,
            policy.ActiveVersion is not null ? ToDto(policy.ActiveVersion) : null,
            policy.Draft is not null ? ToDto(policy.Draft) : null);
    }

    internal static PolicyVersionDto ToDto(TenantObjectivePolicyVersion v) => new(
        v.Id, v.PolicyId, v.VersionNumber, v.Status.ToString(),
        v.MaxObjectivesPerPlan, v.AllowedWeightValues, v.ManagerValidationSlaDays,
        v.CascadeMode, v.MeasurementTypes, v.AttachmentsEnabled,
        v.Version, v.SourceVersionId, v.SourceBaselineVersionId,
        v.CreatedByUserId, v.CreatedByName,
        v.ActivatedAt, v.ActivatedByUserId, v.ActivatedByName,
        v.ChangeSummary, v.SupersededAt);
}

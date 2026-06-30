using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.ObjectiveTemplates.Queries;

public sealed record ApplicabilityOrgUnitDto(string Id, string Name, string Code, string? ParentId);

public sealed record ApplicabilityOptionsDto(
    IReadOnlyList<ApplicabilityOrgUnitDto> OrgUnits,
    IReadOnlyList<string> JobTitles,
    IReadOnlyList<string> WorkLocations,
    IReadOnlyList<string> EmploymentTypes);

public sealed record GetApplicabilityOptionsQuery : IQuery<Result<ApplicabilityOptionsDto>>;

public sealed class GetApplicabilityOptionsQueryHandler(ICoreWorkforceClient coreWorkforceClient)
    : IQueryHandler<GetApplicabilityOptionsQuery, Result<ApplicabilityOptionsDto>>
{
    public async Task<Result<ApplicabilityOptionsDto>> Handle(
        GetApplicabilityOptionsQuery query,
        CancellationToken cancellationToken)
    {
        var options = await coreWorkforceClient.GetApplicabilityOptionsAsync(cancellationToken);
        return Result.Success(new ApplicabilityOptionsDto(
            options.OrgUnits.Select(o => new ApplicabilityOrgUnitDto(
                o.Id.ToString(), o.Name, o.Code, o.ParentId?.ToString())).ToList(),
            options.JobTitles,
            options.WorkLocations,
            options.EmploymentTypes));
    }
}

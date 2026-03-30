using EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Queries.GetOrgUnitTree;

/// <summary>
/// Query for retrieving org units as a hierarchical tree.
/// </summary>
public record GetOrgUnitTreeQuery(
    Guid? RootId = null,
    int MaxDepth = 10,
    bool IncludeInactive = false
) : IQuery<Result<List<OrgUnitTreeNodeDto>>>;

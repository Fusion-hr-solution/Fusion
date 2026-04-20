using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftOrgUnitTree;

public sealed record GetDraftOrgUnitTreeQuery(Guid? RootId, int MaxDepth = 10) : IQuery<List<DraftOrgUnitTreeNodeDto>>;
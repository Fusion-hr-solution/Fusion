using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftOrgUnitById;

public sealed record GetDraftOrgUnitByIdQuery(Guid Id) : IQuery<DraftOrgUnitDto>;
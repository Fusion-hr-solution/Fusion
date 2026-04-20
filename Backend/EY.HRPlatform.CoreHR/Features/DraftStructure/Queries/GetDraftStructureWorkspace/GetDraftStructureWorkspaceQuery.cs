using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Queries.GetDraftStructureWorkspace;

public sealed record GetDraftStructureWorkspaceQuery() : IQuery<DraftStructureWorkspaceDto>;
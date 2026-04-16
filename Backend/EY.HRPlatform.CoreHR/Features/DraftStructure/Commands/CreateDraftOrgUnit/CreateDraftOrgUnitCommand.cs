using EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Commands.CreateDraftOrgUnit;

public sealed record CreateDraftOrgUnitCommand(
    string Code,
    string Name,
    string Type,
    Guid? ParentId) : ICommand<Result<DraftOrgUnitDto>>;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.CompleteTenantSetup;

public sealed record CompleteTenantSetupCommand(
    uint ExpectedVersion,
    Guid ActorUserId,
    string ActorFullName,
    string ActorRole,
    bool IsPlatformAssisted) : ICommand<Result<TenantSetupStateDto>>;
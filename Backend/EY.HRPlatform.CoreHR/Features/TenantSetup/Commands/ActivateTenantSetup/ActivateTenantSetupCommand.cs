using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Commands.ActivateTenantSetup;

public sealed record ActivateTenantSetupCommand() : ICommand<Result<TenantSetupStateDto>>;
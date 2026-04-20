using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Queries.GetTenantSetupState;

public sealed record GetTenantSetupStateQuery() : IQuery<TenantSetupStateDto>;
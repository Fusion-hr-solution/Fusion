using EY.HRPlatform.CoreHR.Features.Setup.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Setup.Queries;

public sealed record GetSetupStateQuery : IQuery<Result<SetupStateDto>>;

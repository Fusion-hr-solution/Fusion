using EY.HRPlatform.CoreHR.Features.Setup.Dtos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.CoreHR.Features.Setup.Commands;

public sealed record MarkEmployeesImportedCommand(uint ExpectedVersion) : ICommand<Result<SetupStateDto>>;

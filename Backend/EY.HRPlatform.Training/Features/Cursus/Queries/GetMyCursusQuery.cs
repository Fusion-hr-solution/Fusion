using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Cursus.Queries;

public record GetMyCursusQuery(Guid EmployeeId) : IQuery<Result<MyCursusDto>>;

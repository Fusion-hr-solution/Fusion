using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public record GetCellEmployeesQuery(Guid GradeId, Guid ServiceLineId)
    : IQuery<Result<List<CellEmployeeDto>>>;

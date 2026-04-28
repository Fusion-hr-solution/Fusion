using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetServiceLinesQueryHandler : IQueryHandler<GetServiceLinesQuery, Result<List<ServiceLineDto>>>
{
    private readonly TrainingDbContext _db;

    public GetServiceLinesQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<ServiceLineDto>>> Handle(GetServiceLinesQuery request, CancellationToken cancellationToken)
    {
        var serviceLines = await _db.ServiceLines
            .AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new ServiceLineDto
            {
                Id = s.Id,
                Name = s.Name,
                Code = s.Code,
                Description = s.Description,
                Color = s.Color,
                IsSharedAcrossAllServiceLines = s.IsSharedAcrossAllServiceLines
            })
            .ToListAsync(cancellationToken);

        return Result.Success(serviceLines);
    }
}

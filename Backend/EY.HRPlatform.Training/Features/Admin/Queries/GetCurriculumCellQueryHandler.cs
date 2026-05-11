using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetCurriculumCellQueryHandler
    : IQueryHandler<GetCurriculumCellQuery, Result<List<CurriculumMappingDto>>>
{
    private readonly TrainingDbContext _db;

    public GetCurriculumCellQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<CurriculumMappingDto>>> Handle(
        GetCurriculumCellQuery request, CancellationToken cancellationToken)
    {
        var mappings = await _db.CurriculumMappings
            .AsNoTracking()
            .Where(m => m.GradeId == request.GradeId && m.ServiceLineId == request.ServiceLineId)
            .Include(m => m.Training)
            .OrderBy(m => m.OrderIndex)
            .Select(m => new CurriculumMappingDto
            {
                Id = m.Id,
                GradeId = m.GradeId,
                ServiceLineId = m.ServiceLineId,
                TrainingId = m.TrainingId,
                TrainingTitle = m.Training.Title,
                TrainingDescription = m.Training.Description,
                TrainingCredits = m.Training.Credits,
                TrainingType = m.Training.TrainingType.ToString(),
                TrainingDuration = m.Training.Duration,
                IsRequired = m.IsRequired,
                OrderIndex = m.OrderIndex
            })
            .ToListAsync(cancellationToken);

        return Result.Success(mappings);
    }
}

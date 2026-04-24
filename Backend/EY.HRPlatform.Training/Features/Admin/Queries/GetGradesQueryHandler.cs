using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetGradesQueryHandler : IQueryHandler<GetGradesQuery, Result<List<GradeDto>>>
{
    private readonly TrainingDbContext _db;

    public GetGradesQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<GradeDto>>> Handle(GetGradesQuery request, CancellationToken cancellationToken)
    {
        var grades = await _db.Grades
            .OrderBy(g => g.Level)
            .Select(g => new GradeDto
            {
                Id = g.Id,
                Name = g.Name,
                Level = g.Level,
                Description = g.Description,
                Icon = g.Icon
            })
            .ToListAsync(cancellationToken);

        return Result.Success(grades);
    }
}

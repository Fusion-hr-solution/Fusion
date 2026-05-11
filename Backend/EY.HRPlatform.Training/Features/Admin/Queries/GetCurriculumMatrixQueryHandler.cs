using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetCurriculumMatrixQueryHandler
    : IQueryHandler<GetCurriculumMatrixQuery, Result<CurriculumMatrixDto>>
{
    private readonly TrainingDbContext _db;

    public GetCurriculumMatrixQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<CurriculumMatrixDto>> Handle(
        GetCurriculumMatrixQuery request, CancellationToken cancellationToken)
    {
        var grades = await _db.Grades
            .AsNoTracking()
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

        var cells = await _db.CurriculumMappings
            .AsNoTracking()
            .GroupBy(m => new { m.GradeId, m.ServiceLineId })
            .Select(g => new CurriculumCellDto
            {
                GradeId = g.Key.GradeId,
                ServiceLineId = g.Key.ServiceLineId,
                FormationCount = g.Count(),
                IsRequiredCount = g.Count(m => m.IsRequired)
            })
            .ToListAsync(cancellationToken);

        return Result.Success(new CurriculumMatrixDto
        {
            Grades = grades,
            ServiceLines = serviceLines,
            Cells = cells
        });
    }
}

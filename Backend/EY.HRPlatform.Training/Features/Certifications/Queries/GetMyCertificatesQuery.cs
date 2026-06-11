using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Certifications.Queries;

public record GetMyCertificatesQuery(Guid EmployeeId) : IQuery<Result<List<MyCertificateDto>>>;

public class GetMyCertificatesQueryHandler : IQueryHandler<GetMyCertificatesQuery, Result<List<MyCertificateDto>>>
{
    private readonly TrainingDbContext _db;

    public GetMyCertificatesQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<MyCertificateDto>>> Handle(GetMyCertificatesQuery request, CancellationToken cancellationToken)
    {
        // Projection excludes PdfContent — list reads must never drag the blob into memory.
        var items = await _db.Certifications
            .AsNoTracking()
            .Where(c => c.EmployeeId == request.EmployeeId)
            .OrderByDescending(c => c.IssuedAt)
            .Select(c => new MyCertificateDto
            {
                Id = c.Id,
                CertificateNumber = c.CertificateNumber,
                TrainingTitle = c.TrainingTitle,
                TrainingDescription = c.TrainingDescription,
                Credits = c.Credits,
                Duration = c.Duration,
                TrainerName = c.TrainerName,
                GradeName = c.GradeName,
                ServiceLineName = c.ServiceLineName,
                CompletedAt = c.CompletedAt,
                IssuedAt = c.IssuedAt,
                Status = c.Status.ToString(),
                RevokedAt = c.RevokedAt,
                RevokedReason = c.RevokedReason
            })
            .ToListAsync(cancellationToken);

        return Result.Success(items);
    }
}

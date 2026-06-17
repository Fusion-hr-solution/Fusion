using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Certifications.Queries;

public record GetCertificateRegistryQuery(
    Guid? TrainingId,
    Guid? GradeId,
    DateTime? From,
    DateTime? To,
    string? Status,
    string? Search,
    int Page,
    int PageSize) : IQuery<Result<PagedResponse<CertificateRegistryDto>>>;

public class GetCertificateRegistryQueryHandler
    : IQueryHandler<GetCertificateRegistryQuery, Result<PagedResponse<CertificateRegistryDto>>>
{
    private readonly TrainingDbContext _db;

    public GetCertificateRegistryQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<PagedResponse<CertificateRegistryDto>>> Handle(
        GetCertificateRegistryQuery request, CancellationToken cancellationToken)
    {
        var query = CertificateRegistryFilter.Apply(
            _db.Certifications.AsNoTracking(),
            request.TrainingId, request.GradeId, request.From, request.To, request.Status, request.Search);

        var totalCount = await query.CountAsync(cancellationToken);

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var items = await query
            .OrderByDescending(c => c.IssuedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CertificateRegistryDto
            {
                Id = c.Id,
                CertificateNumber = c.CertificateNumber,
                EmployeeId = c.EmployeeId,
                EmployeeFullName = c.EmployeeFullName,
                GradeName = c.GradeName,
                ServiceLineName = c.ServiceLineName,
                TrainingId = c.TrainingId,
                TrainingTitle = c.TrainingTitle,
                Credits = c.Credits,
                CompletedAt = c.CompletedAt,
                IssuedAt = c.IssuedAt,
                Status = c.Status.ToString(),
                RevokedAt = c.RevokedAt,
                RevokedReason = c.RevokedReason,
                RevokedBy = c.RevokedBy
            })
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResponse<CertificateRegistryDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        });
    }
}

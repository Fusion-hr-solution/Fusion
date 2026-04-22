using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public class GetEmployeeProfilesQueryHandler
    : IQueryHandler<GetEmployeeProfilesQuery, Result<PagedResponse<EmployeeProfileDto>>>
{
    private readonly TrainingDbContext _db;

    public GetEmployeeProfilesQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<PagedResponse<EmployeeProfileDto>>> Handle(
        GetEmployeeProfilesQuery request, CancellationToken cancellationToken)
    {
        if (request.Page < 1)
            return Result.Failure<PagedResponse<EmployeeProfileDto>>(
                Error.Validation("Pagination.InvalidPage", "Page must be 1 or greater."));

        if (request.PageSize < 1)
            return Result.Failure<PagedResponse<EmployeeProfileDto>>(
                Error.Validation("Pagination.InvalidPageSize", "PageSize must be 1 or greater."));

        var query = _db.EmployeeProfiles
            .Include(p => p.Grade)
            .Include(p => p.ServiceLine)
            .AsQueryable();

        var totalCount = await query.CountAsync(cancellationToken);

        var profiles = await query
            .OrderBy(p => p.EmployeeId)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(p => new EmployeeProfileDto
            {
                Id = p.Id,
                EmployeeId = p.EmployeeId,
                GradeId = p.GradeId,
                GradeName = p.Grade != null ? p.Grade.Name : null,
                ServiceLineId = p.ServiceLineId,
                ServiceLineName = p.ServiceLine != null ? p.ServiceLine.Name : null,
                ServiceLineColor = p.ServiceLine != null ? p.ServiceLine.Color : null
            })
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResponse<EmployeeProfileDto>
        {
            Items = profiles,
            TotalCount = totalCount,
            Page = request.Page,
            PageSize = request.PageSize
        });
    }
}

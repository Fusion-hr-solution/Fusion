using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Queries;

public record GetSessionsQuery(
    Guid? TrainingId,
    DateTime? FromUtc,
    DateTime? ToUtc,
    string? Status,
    Guid? TrainerEmployeeId,
    string? Search,
    int Page,
    int PageSize) : IQuery<Result<PagedResponse<TrainingSessionListItemDto>>>;

public class GetSessionsQueryHandler : IQueryHandler<GetSessionsQuery, Result<PagedResponse<TrainingSessionListItemDto>>>
{
    private readonly TrainingDbContext _db;

    public GetSessionsQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<PagedResponse<TrainingSessionListItemDto>>> Handle(
        GetSessionsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var query = _db.TrainingSessions.AsNoTracking().AsQueryable();

        if (request.TrainingId.HasValue)
            query = query.Where(s => s.Part.TrainingId == request.TrainingId.Value);

        if (request.FromUtc.HasValue)
            query = query.Where(s => s.StartUtc >= request.FromUtc.Value);

        if (request.ToUtc.HasValue)
            query = query.Where(s => s.StartUtc <= request.ToUtc.Value);

        if (request.TrainerEmployeeId.HasValue)
            query = query.Where(s => s.TrainerEmployeeId == request.TrainerEmployeeId.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLower();
            query = query.Where(s =>
                s.Room.ToLower().Contains(search) ||
                s.Part.Title.ToLower().Contains(search) ||
                s.Part.Training.Title.ToLower().Contains(search) ||
                (s.TrainerName != null && s.TrainerName.ToLower().Contains(search)));
        }

        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<SessionStatus>(request.Status, true, out var statusFilter))
        {
            // Persisted-status filter; effective-time-based projection still applied below.
            query = query.Where(s => s.Status == statusFilter);
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(s => s.StartUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new
            {
                s.Id,
                s.PartId,
                PartTitle = s.Part.Title,
                TrainingId = s.Part.TrainingId,
                TrainingTitle = s.Part.Training.Title,
                s.StartUtc,
                s.EndUtc,
                s.Room,
                s.MaxCapacity,
                s.TrainerName,
                s.TrainerEmployeeId,
                s.Status
            })
            .ToListAsync(cancellationToken);

        var nowUtc = DateTime.UtcNow;
        var dtos = items.Select(s => new TrainingSessionListItemDto
        {
            Id = s.Id,
            PartId = s.PartId,
            PartTitle = s.PartTitle,
            TrainingId = s.TrainingId,
            TrainingTitle = s.TrainingTitle,
            StartUtc = s.StartUtc,
            EndUtc = s.EndUtc,
            Room = s.Room,
            MaxCapacity = s.MaxCapacity,
            EnrolledCount = 0,
            TrainerName = s.TrainerName,
            TrainerEmployeeId = s.TrainerEmployeeId,
            Status = ProjectStatus(s.Status, s.StartUtc, s.EndUtc, nowUtc).ToString()
        }).ToList();

        return Result.Success(new PagedResponse<TrainingSessionListItemDto>
        {
            Items = dtos,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        });
    }

    private static SessionStatus ProjectStatus(SessionStatus persisted, DateTime startUtc, DateTime endUtc, DateTime nowUtc)
    {
        if (persisted is SessionStatus.Cancelled or SessionStatus.Completed) return persisted;
        if (nowUtc >= endUtc) return SessionStatus.Completed;
        if (nowUtc >= startUtc) return SessionStatus.InProgress;
        return SessionStatus.Planned;
    }
}

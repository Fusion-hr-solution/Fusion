using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Parts.Queries;

public record GetPartsForTrainingQuery(Guid TrainingId) : IQuery<Result<List<TrainingPartDto>>>;

public class GetPartsForTrainingQueryHandler : IQueryHandler<GetPartsForTrainingQuery, Result<List<TrainingPartDto>>>
{
    private readonly TrainingDbContext _db;

    public GetPartsForTrainingQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<List<TrainingPartDto>>> Handle(GetPartsForTrainingQuery request, CancellationToken cancellationToken)
    {
        var trainingExists = await _db.Trainings
            .AsNoTracking()
            .IgnoreQueryFilters()
            .AnyAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (!trainingExists)
            return Result.Failure<List<TrainingPartDto>>(Error.NotFound("Training", request.TrainingId));

        var parts = await _db.TrainingParts
            .AsNoTracking()
            .Where(p => p.TrainingId == request.TrainingId)
            .OrderBy(p => p.OrderIndex)
            .Select(p => new TrainingPartDto
            {
                Id = p.Id,
                TrainingId = p.TrainingId,
                Title = p.Title,
                Description = p.Description,
                OrderIndex = p.OrderIndex,
                DurationHours = p.DurationHours,
                IsLocked = p.IsLocked,
                SessionCount = p.Sessions.Count,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                Sessions = p.Sessions
                    .OrderBy(s => s.StartUtc)
                    .Select(s => new TrainingSessionDto
                    {
                        Id = s.Id,
                        PartId = s.PartId,
                        StartUtc = s.StartUtc,
                        EndUtc = s.EndUtc,
                        Room = s.Room,
                        MaxCapacity = s.MaxCapacity,
                        EnrolledCount = _db.SessionEnrollments.Count(e =>
                            e.SessionId == s.Id &&
                            (e.Status == EnrollmentStatus.Enrolled || e.Status == EnrollmentStatus.Attended)),
                        Notes = s.Notes,
                        TrainerEmployeeId = s.TrainerEmployeeId,
                        TrainerName = s.TrainerName,
                        TrainerEmail = s.TrainerEmail,
                        Status = s.Status.ToString(),
                        CancelReason = s.CancelReason,
                        CancelledAt = s.CancelledAt,
                        CreatedAt = s.CreatedAt,
                        UpdatedAt = s.UpdatedAt
                    }).ToList()
            })
            .ToListAsync(cancellationToken);

        return Result.Success(parts);
    }
}

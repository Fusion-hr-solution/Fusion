using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Calendar.Conflicts;

/// <summary>
/// Sibling of RoomConflictDetector that probes BOTH room and trainer overlaps for a candidate
/// window. Uses the same half-open [Start, End) overlap test and the same cancelled / exclude-self
/// filters. Trainer overlap is reported only when the trainer is <i>verifiable</i> — an internal
/// <c>TrainerEmployeeId</c> or an exact <c>TrainerEmail</c>; an external trainer known only by
/// free-text name is unverifiable, in which case <see cref="ScheduleConflictResultDto.TrainerCheckable"/>
/// is false and no trainer conflicts are returned.
/// </summary>
public static class ScheduleConflictDetector
{
    public static async Task<ScheduleConflictResultDto> DetectAsync(
        TrainingDbContext db,
        string? room,
        Guid? trainerEmployeeId,
        string? trainerEmail,
        DateTime startUtc,
        DateTime endUtc,
        Guid? excludeSessionId,
        CancellationToken cancellationToken)
    {
        var result = new ScheduleConflictResultDto();

        var normalizedRoom = (room ?? string.Empty).Trim();
        if (!string.IsNullOrEmpty(normalizedRoom))
        {
            var roomLower = normalizedRoom.ToLower();
            result.RoomConflicts = await db.TrainingSessions
                .AsNoTracking()
                .Where(s =>
                    s.Status != SessionStatus.Cancelled &&
                    s.Room.ToLower() == roomLower &&
                    s.StartUtc < endUtc &&
                    s.EndUtc > startUtc &&
                    (excludeSessionId == null || s.Id != excludeSessionId))
                .Select(s => new ScheduleConflictItemDto
                {
                    SessionId = s.Id,
                    PartId = s.PartId,
                    TrainingId = s.Part.TrainingId,
                    TrainingTitle = s.Part.Training.Title,
                    PartTitle = s.Part.Title,
                    Room = s.Room,
                    TrainerName = s.TrainerName,
                    StartUtc = s.StartUtc,
                    EndUtc = s.EndUtc
                })
                .ToListAsync(cancellationToken);
        }

        var email = (trainerEmail ?? string.Empty).Trim();
        result.TrainerCheckable = trainerEmployeeId.HasValue || !string.IsNullOrEmpty(email);
        if (result.TrainerCheckable)
        {
            var query = db.TrainingSessions
                .AsNoTracking()
                .Where(s =>
                    s.Status != SessionStatus.Cancelled &&
                    s.StartUtc < endUtc &&
                    s.EndUtc > startUtc &&
                    (excludeSessionId == null || s.Id != excludeSessionId));

            if (trainerEmployeeId.HasValue)
            {
                query = query.Where(s => s.TrainerEmployeeId == trainerEmployeeId.Value);
            }
            else
            {
                var emailLower = email.ToLower();
                query = query.Where(s => s.TrainerEmail != null && s.TrainerEmail.ToLower() == emailLower);
            }

            result.TrainerConflicts = await query
                .Select(s => new ScheduleConflictItemDto
                {
                    SessionId = s.Id,
                    PartId = s.PartId,
                    TrainingId = s.Part.TrainingId,
                    TrainingTitle = s.Part.Training.Title,
                    PartTitle = s.Part.Title,
                    Room = s.Room,
                    TrainerName = s.TrainerName,
                    StartUtc = s.StartUtc,
                    EndUtc = s.EndUtc
                })
                .ToListAsync(cancellationToken);
        }

        return result;
    }
}

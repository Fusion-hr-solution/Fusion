using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Sessions;

/// <summary>
/// Shared helper for detecting time-overlapping sessions in the same room across the platform.
/// A conflict is any non-cancelled session whose [Start, End) overlaps the candidate window
/// for the same room (case-insensitive trimmed match), excluding the candidate session itself.
/// </summary>
public static class RoomConflictDetector
{
    public static async Task<List<RoomConflictItem>> DetectAsync(
        TrainingDbContext db,
        string room,
        DateTime startUtc,
        DateTime endUtc,
        Guid? excludeSessionId,
        CancellationToken cancellationToken)
    {
        var normalizedRoom = (room ?? string.Empty).Trim();

        if (string.IsNullOrEmpty(normalizedRoom))
            return [];

        return await db.TrainingSessions
            .AsNoTracking()
            .Where(s =>
                s.Status != SessionStatus.Cancelled &&
                s.Room.ToLower() == normalizedRoom.ToLower() &&
                s.StartUtc < endUtc &&
                s.EndUtc > startUtc &&
                (excludeSessionId == null || s.Id != excludeSessionId))
            .Select(s => new RoomConflictItem(
                s.Id,
                s.PartId,
                s.Part.TrainingId,
                s.Part.Training.Title,
                s.Part.Title,
                s.Room,
                s.StartUtc,
                s.EndUtc))
            .ToListAsync(cancellationToken);
    }
}

public record RoomConflictItem(
    Guid SessionId,
    Guid PartId,
    Guid TrainingId,
    string TrainingTitle,
    string PartTitle,
    string Room,
    DateTime StartUtc,
    DateTime EndUtc);

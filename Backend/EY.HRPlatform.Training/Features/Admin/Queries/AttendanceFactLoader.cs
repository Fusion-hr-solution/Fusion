using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

/// <summary>
/// Common filter applied across every attendance aggregation (AC#3).
/// All members are optional — a null member means "no constraint on this dimension".
/// </summary>
public record AttendanceFilter(
    Guid? GradeId = null,
    Guid? ServiceLineId = null,
    Guid? TrainingId = null,
    DateTime? From = null,
    DateTime? To = null);

/// <summary>
/// A single enrollment-on-session fact, flattened with the dimensions needed by the
/// attendance dashboards. Absence is derived (US-5.3.2 decision A): an enrollment is
/// "present" when Attended, "absent" when the session has closed without attendance,
/// and "pending" otherwise. Cancelled/Waitlisted enrollments and Cancelled sessions
/// are excluded upstream so they never reach a fact.
/// </summary>
public record AttendanceFact(
    Guid EmployeeId,
    Guid SessionId,
    Guid TrainingId,
    DateTime StartUtc,
    decimal Hours,
    bool IsClosed,
    bool IsPresent,
    Guid? GradeId,
    Guid? ServiceLineId);

internal static class AttendanceFactLoader
{
    /// <summary>
    /// Loads attendance facts for the given filter. A fact is produced for each
    /// non-cancelled, non-waitlisted enrollment on a non-cancelled session.
    /// </summary>
    public static async Task<List<AttendanceFact>> LoadAsync(
        TrainingDbContext db,
        AttendanceFilter filter,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var enrollmentsQuery = db.SessionEnrollments
            .AsNoTracking()
            .Include(e => e.Session).ThenInclude(s => s.Part).ThenInclude(p => p.Training)
            .Where(e =>
                e.Status != EnrollmentStatus.Cancelled
                && e.Status != EnrollmentStatus.Waitlisted
                && e.Session.Status != SessionStatus.Cancelled);

        if (filter.TrainingId.HasValue)
            enrollmentsQuery = enrollmentsQuery.Where(e => e.Session.Part.TrainingId == filter.TrainingId.Value);

        if (filter.From.HasValue)
            enrollmentsQuery = enrollmentsQuery.Where(e => e.Session.StartUtc >= filter.From.Value);

        if (filter.To.HasValue)
            enrollmentsQuery = enrollmentsQuery.Where(e => e.Session.StartUtc <= filter.To.Value);

        var enrollments = await enrollmentsQuery
            .Select(e => new
            {
                e.EmployeeId,
                e.SessionId,
                TrainingId = e.Session.Part.TrainingId,
                e.Session.StartUtc,
                e.Session.EndUtc,
                SessionStatus = e.Session.Status,
                Hours = e.Session.Part.DurationHours,
                IsAttended = e.Status == EnrollmentStatus.Attended
            })
            .ToListAsync(cancellationToken);

        // Resolve grade / service line per employee (Unassigned when no profile — decision Q4).
        var employeeIds = enrollments.Select(e => e.EmployeeId).Distinct().ToList();
        var profiles = await db.EmployeeProfiles
            .AsNoTracking()
            .Where(ep => employeeIds.Contains(ep.EmployeeId))
            .Select(ep => new { ep.EmployeeId, ep.GradeId, ep.ServiceLineId })
            .ToListAsync(cancellationToken);

        var profileLookup = profiles
            .GroupBy(p => p.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First());

        var facts = new List<AttendanceFact>(enrollments.Count);
        foreach (var e in enrollments)
        {
            profileLookup.TryGetValue(e.EmployeeId, out var profile);

            // Apply grade / service-line filters after profile resolution.
            if (filter.GradeId.HasValue && profile?.GradeId != filter.GradeId.Value)
                continue;
            if (filter.ServiceLineId.HasValue && profile?.ServiceLineId != filter.ServiceLineId.Value)
                continue;

            var isClosed = e.SessionStatus == SessionStatus.Completed || nowUtc >= e.EndUtc;

            facts.Add(new AttendanceFact(
                e.EmployeeId,
                e.SessionId,
                e.TrainingId,
                e.StartUtc,
                e.Hours,
                isClosed,
                e.IsAttended,
                profile?.GradeId,
                profile?.ServiceLineId));
        }

        return facts;
    }

    /// <summary>Round a present/counted ratio to a 0–100 percentage with one decimal.</summary>
    public static double Rate(int present, int counted) =>
        counted > 0 ? Math.Round((double)present / counted * 100, 1) : 0;
}

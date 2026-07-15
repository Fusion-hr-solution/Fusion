using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EY.HRPlatform.Training.Features.Calendar.Reminders;

/// <summary>
/// The reminder phase of the calendar background service: finds confirmed learners whose session
/// starts within a reminder lead-time, sends an email, and records a <see cref="ReminderDelivery"/>
/// so it fires at most once per (session, learner, offset). Catches up on a missed window while its
/// bracket is still open and never sends after the session has started; a window fully missed during
/// downtime is skipped. Assumes a single background-service instance (the scan has no claim lock).
/// </summary>
public sealed class ReminderScanner
{
    private static readonly IReadOnlyList<int> DefaultOffsets = new[] { 1440, 60 };

    private readonly TrainingDbContext _db;
    private readonly IReminderEmailSender _sender;
    private readonly TimeZoneInfo _displayTz;
    private readonly ILogger<ReminderScanner> _logger;

    public ReminderScanner(
        TrainingDbContext db,
        IReminderEmailSender sender,
        IConfiguration configuration,
        ILogger<ReminderScanner> logger)
    {
        _db = db;
        _sender = sender;
        _logger = logger;
        _displayTz = ResolveTimeZone(configuration["Calendar:DisplayTimeZone"]);
    }

    public async Task ScanAsync(DateTime nowUtc, CancellationToken cancellationToken)
    {
        var policy = await _db.ReminderPolicies.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        if (policy is not null && !policy.Enabled) return;

        var offsets = policy?.Offsets() ?? DefaultOffsets;
        if (offsets.Count == 0) return;

        var horizon = nowUtc.AddMinutes(offsets.Max());

        // Sessions starting in the future but within the widest reminder window, not cancelled.
        var sessions = await _db.TrainingSessions
            .AsNoTracking()
            .Where(s => s.Status != SessionStatus.Cancelled && s.StartUtc > nowUtc && s.StartUtc <= horizon)
            .Select(s => new
            {
                s.Id,
                s.StartUtc,
                s.Room,
                s.MeetingUrl,
                PartTitle = s.Part.Title,
                TrainingTitle = s.Part.Training.Title,
            })
            .ToListAsync(cancellationToken);

        foreach (var session in sessions)
        {
            var minutesUntil = (session.StartUtc - nowUtc).TotalMinutes;
            var dueOffset = DueOffset(offsets, minutesUntil); // the single offset whose bracket is current
            if (dueOffset is null) continue;

            var attendees = await _db.SessionEnrollments
                .AsNoTracking()
                .Where(e => e.SessionId == session.Id
                            && (e.Status == EnrollmentStatus.Enrolled || e.Status == EnrollmentStatus.Attended)
                            && e.EmployeeEmail != null)
                .Select(e => new { e.EmployeeId, e.EmployeeEmail, e.EmployeeName })
                .ToListAsync(cancellationToken);
            if (attendees.Count == 0) continue;

            var localStart = TimeZoneInfo.ConvertTimeFromUtc(
                DateTime.SpecifyKind(session.StartUtc, DateTimeKind.Utc), _displayTz);
            var where = string.IsNullOrWhiteSpace(session.MeetingUrl) ? session.Room : session.MeetingUrl;
            var subject = $"Reminder: {session.TrainingTitle} — {session.PartTitle}";
            var body =
                $"This is a reminder that your training session \"{session.TrainingTitle} — {session.PartTitle}\" " +
                $"starts on {localStart:yyyy-MM-dd} at {localStart:HH:mm} ({_displayTz.Id})." +
                (string.IsNullOrWhiteSpace(where) ? string.Empty : $"{Environment.NewLine}Where: {where}");

            var offset = dueOffset.Value;

            // Batch the dedupe: load who already got this (session, offset) reminder in one query
            // (instead of one AnyAsync per attendee, every minute, for the whole bracket).
            var delivered = (await _db.ReminderDeliveries
                .Where(d => d.SessionId == session.Id && d.OffsetMinutes == offset && d.Channel == "Email")
                .Select(d => d.EmployeeId)
                .ToListAsync(cancellationToken)).ToHashSet();

            foreach (var a in attendees)
            {
                if (delivered.Contains(a.EmployeeId)) continue;

                try
                {
                    await _sender.SendAsync(
                        new ReminderEmailMessage(a.EmployeeEmail!, a.EmployeeName, subject, body), cancellationToken);
                    _db.ReminderDeliveries.Add(new ReminderDelivery(session.Id, a.EmployeeId, offset, "Email"));
                    await _db.SaveChangesAsync(cancellationToken);
                }
                catch (Exception ex)
                {
                    // Drop the failed (and any pending) tracked insert so it can't cascade to the next
                    // attendee; the delivery wasn't recorded, so the next scan retries this one only.
                    _db.ChangeTracker.Clear();
                    _logger.LogWarning(ex,
                        "Reminder send failed for session {SessionId} employee {EmployeeId} offset {Offset}.",
                        session.Id, a.EmployeeId, offset);
                }
            }
        }
    }

    /// <summary>
    /// The single offset whose bracket <c>(nextSmaller, O]</c> currently contains the minutes-until-start,
    /// so each lead time fires once in its own window (a 30-min-away session gets the 1h reminder, not also
    /// the 24h one). Returns null when the session is outside every bracket.
    /// </summary>
    private static int? DueOffset(IReadOnlyList<int> offsets, double minutesUntil)
    {
        // Normalize defensively so the bracket math never depends on caller ordering/dedup.
        var ordered = offsets.Where(o => o > 0).Distinct().OrderByDescending(o => o).ToList();
        for (var i = 0; i < ordered.Count; i++)
        {
            var upper = ordered[i];
            var lower = i + 1 < ordered.Count ? ordered[i + 1] : 0;
            if (minutesUntil > lower && minutesUntil <= upper) return upper;
        }
        return null;
    }

    private static TimeZoneInfo ResolveTimeZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) id = "Africa/Tunis";
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch { return TimeZoneInfo.Utc; }
    }
}

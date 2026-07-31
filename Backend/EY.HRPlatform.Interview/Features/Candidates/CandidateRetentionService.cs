using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Candidates;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.Candidates;

public class CandidateRetentionService(
    AppDbContext dbContext,
    ICandidatePrivacyActionExecutor privacyExecutor,
    ILogger<CandidateRetentionService> logger)
    : ICandidateRetentionService
{
    private static readonly Guid RetentionSettingsId = Guid.Parse("3a7e9f21-1c34-4d88-b012-5f6a8c9d0e11");
    private const int MaxRecentRuns = 20;

    public async Task<CandidateRetentionStateDto> GetStateAsync(CancellationToken cancellationToken)
    {
        var settings = await GetOrCreateSettingsAsync(cancellationToken);

        var pendingCount = await CountPendingCandidatesAsync(settings, cancellationToken);

        var recentRuns = await dbContext.CandidateRetentionRuns
            .AsNoTracking()
            .OrderByDescending(item => item.StartedAtUtc)
            .Take(MaxRecentRuns)
            .ToListAsync(cancellationToken);

        return new CandidateRetentionStateDto
        {
            Settings = MapSettings(settings),
            PendingCount = pendingCount,
            RecentRuns = recentRuns.Select(MapRun).ToList(),
        };
    }

    public async Task<int> GetPendingCountAsync(CancellationToken cancellationToken)
    {
        var settings = await GetOrCreateSettingsAsync(cancellationToken);
        return await CountPendingCandidatesAsync(settings, cancellationToken);
    }

    public async Task<CandidateRetentionSettingsDto> SaveSettingsAsync(
        UpdateCandidateRetentionSettingsDto request,
        CancellationToken cancellationToken)
    {
        ValidateSettings(request);

        var settings = await dbContext.CandidateRetentionSettings
            .FirstOrDefaultAsync(item => item.Id == RetentionSettingsId, cancellationToken);

        if (settings is null)
        {
            settings = new CandidateRetentionSettings();
            dbContext.Entry(settings).Property(item => item.Id).CurrentValue = RetentionSettingsId;
            dbContext.CandidateRetentionSettings.Add(settings);
        }

        settings.Enabled = request.Enabled;
        settings.RetentionAction = NormalizeAction(request.RetentionAction);
        settings.RetentionPeriodDays = request.RetentionPeriodDays;
        settings.ScanIntervalHours = request.ScanIntervalHours;

        await dbContext.SaveChangesAsync(cancellationToken);
        return MapSettings(settings);
    }

    // A lock held longer than this is considered stale (crashed/hung replica).
    private static readonly TimeSpan SweepLockTimeout = TimeSpan.FromHours(2);

    public async Task<CandidateRetentionRunDto?> RunRetentionSweepAsync(
        string triggeredBy,
        string triggerSource,
        CancellationToken cancellationToken)
    {
        var settings = await GetOrCreateSettingsAsync(cancellationToken);

        if (!settings.Enabled || settings.RetentionPeriodDays <= 0)
        {
            var at = DateTime.UtcNow;
            var disabledRun = new CandidateRetentionRun
            {
                TriggeredBy = triggeredBy.Trim(),
                TriggerSource = triggerSource,
                RetentionAction = settings.RetentionAction,
                RetentionPeriodDays = settings.RetentionPeriodDays,
                StartedAtUtc = at,
                CompletedAtUtc = at,
            };
            dbContext.CandidateRetentionRuns.Add(disabledRun);
            settings.LastRunAtUtc = at;
            await dbContext.SaveChangesAsync(cancellationToken);
            return MapRun(disabledRun);
        }

        // Atomically acquire the sweep lock. Uses a single UPDATE ... WHERE to test-and-set;
        // the row-level lock in the database serialises concurrent replicas correctly.
        var staleThreshold = DateTime.UtcNow - SweepLockTimeout;
        var acquired = await dbContext.CandidateRetentionSettings
            .Where(s => s.Id == RetentionSettingsId
                        && (s.SweepLockedAtUtc == null || s.SweepLockedAtUtc < staleThreshold))
            .ExecuteUpdateAsync(
                s => s.SetProperty(x => x.SweepLockedAtUtc, DateTime.UtcNow),
                cancellationToken);

        if (acquired == 0)
        {
            logger.LogInformation(
                "CandidateRetentionSweep: skipping — another instance already holds the sweep lock.");
            return null;
        }

        var startedAt = DateTime.UtcNow;
        var run = new CandidateRetentionRun
        {
            TriggeredBy = triggeredBy.Trim(),
            TriggerSource = triggerSource,
            RetentionAction = settings.RetentionAction,
            RetentionPeriodDays = settings.RetentionPeriodDays,
            StartedAtUtc = startedAt,
        };

        try
        {
            var cutoffUtc = startedAt.AddDays(-settings.RetentionPeriodDays);
            var action = settings.RetentionAction;

            // Aggregate per-candidate activity in the database — avoids loading all invitations into memory.
            // Groups by (TestId, normalised email) and computes the latest activity clock per group.
            var candidateSummaries = await dbContext.CandidateInvitations
                .AsNoTracking()
                .Where(i => i.Status != "Expired" && i.Email != null && i.Email.Trim() != "")
                .Select(i => new
                {
                    i.TestId,
                    NormalizedEmail = i.Email.Trim().ToLower(),
                    ActivityAt = i.AttemptSubmittedAtUtc ?? i.AttemptStartedAtUtc ?? (DateTime?)i.LastSentAtUtc ?? i.CreatedAt,
                })
                .GroupBy(i => new { i.TestId, i.NormalizedEmail })
                .Select(g => new
                {
                    g.Key.TestId,
                    g.Key.NormalizedEmail,
                    LatestActivity = g.Max(i => i.ActivityAt),
                })
                .ToListAsync(cancellationToken);

            run.CandidatesScanned = candidateSummaries.Count;

            var dueGroups = candidateSummaries
                .Where(x => x.LatestActivity <= cutoffUtc)
                .ToList();

            int anonymized = 0, deleted = 0, expired = 0;

            // Batch-load invitations per test so we issue one query per test, not one per candidate.
            foreach (var testGroup in dueGroups.GroupBy(d => d.TestId))
            {
                var dueEmails = testGroup.Select(d => d.NormalizedEmail).ToList();

                switch (action)
                {
                    case "Anonymize":
                    {
                        var invitations = await dbContext.CandidateInvitations
                            .Where(i => i.TestId == testGroup.Key
                                        && i.Status != "Expired"
                                        && dueEmails.Contains(i.Email.Trim().ToLower()))
                            .ToListAsync(cancellationToken);

                        foreach (var group in invitations.GroupBy(i => NormalizeEmail(i.Email)))
                        {
                            await privacyExecutor.PseudonymizeAsync(
                                testGroup.Key,
                                group.Key,
                                "anonymize",
                                string.IsNullOrWhiteSpace(triggeredBy) ? "RetentionJob" : triggeredBy,
                                string.IsNullOrWhiteSpace(triggerSource) ? "RetentionJob" : triggerSource,
                                group.ToList(),
                                cancellationToken);
                            anonymized++;
                        }
                        break;
                    }

                    case "Delete":
                    {
                        if (dbContext.Database.IsRelational())
                        {
                            var invitationIds = await dbContext.CandidateInvitations
                                .AsNoTracking()
                                .Where(i => i.TestId == testGroup.Key
                                            && i.Status != "Expired"
                                            && dueEmails.Contains(i.Email.Trim().ToLower()))
                                .Select(i => i.Id)
                                .ToListAsync(cancellationToken);

                            // Proctoring events hang off the attempt (not the invitation), so resolve
                            // the attempt ids and delete them before the attempts. Postgres would
                            // cascade via the FK, but deleting explicitly keeps the intent obvious.
                            var attemptIds = await dbContext.CandidateTestAttempts
                                .AsNoTracking()
                                .Where(a => invitationIds.Contains(a.InvitationId))
                                .Select(a => a.Id)
                                .ToListAsync(cancellationToken);

                            await dbContext.CandidateProctoringEvents
                                .Where(e => attemptIds.Contains(e.AttemptId))
                                .ExecuteDeleteAsync(cancellationToken);
                            await dbContext.CandidateProgressEvents
                                .Where(i => invitationIds.Contains(i.InvitationId))
                                .ExecuteDeleteAsync(cancellationToken);
                            await dbContext.CandidateTestAttempts
                                .Where(i => invitationIds.Contains(i.InvitationId))
                                .ExecuteDeleteAsync(cancellationToken);
                            await dbContext.CandidateInvitations
                                .Where(i => invitationIds.Contains(i.Id))
                                .ExecuteDeleteAsync(cancellationToken);
                        }
                        else
                        {
                            var invitationsToDelete = await dbContext.CandidateInvitations
                                .Where(i => i.TestId == testGroup.Key
                                            && i.Status != "Expired"
                                            && dueEmails.Contains(i.Email.Trim().ToLower()))
                                .ToListAsync(cancellationToken);

                            var invitationIds = invitationsToDelete.Select(i => i.Id).ToList();

                            var eventsToDelete = await dbContext.CandidateProgressEvents
                                .Where(i => invitationIds.Contains(i.InvitationId))
                                .ToListAsync(cancellationToken);
                            dbContext.CandidateProgressEvents.RemoveRange(eventsToDelete);

                            var attemptsToDelete = await dbContext.CandidateTestAttempts
                                .Where(i => invitationIds.Contains(i.InvitationId))
                                .ToListAsync(cancellationToken);

                            // The in-memory provider doesn't enforce FK cascade, so remove the
                            // attempts' proctoring events explicitly before the attempts themselves.
                            var attemptIds = attemptsToDelete.Select(a => a.Id).ToList();
                            var proctoringToDelete = await dbContext.CandidateProctoringEvents
                                .Where(e => attemptIds.Contains(e.AttemptId))
                                .ToListAsync(cancellationToken);
                            dbContext.CandidateProctoringEvents.RemoveRange(proctoringToDelete);

                            dbContext.CandidateTestAttempts.RemoveRange(attemptsToDelete);

                            dbContext.CandidateInvitations.RemoveRange(invitationsToDelete);
                            await dbContext.SaveChangesAsync(cancellationToken);
                        }

                        deleted += dueEmails.Count;
                        break;
                    }

                    case "Expire":
                    {
                        if (dbContext.Database.IsRelational())
                        {
                            await dbContext.CandidateInvitations
                                .Where(i => i.TestId == testGroup.Key
                                            && i.Status != "Expired"
                                            && dueEmails.Contains(i.Email.Trim().ToLower()))
                                .ExecuteUpdateAsync(
                                    s => s.SetProperty(i => i.Status, "Expired"),
                                    cancellationToken);
                        }
                        else
                        {
                            var invitations = await dbContext.CandidateInvitations
                                .Where(i => i.TestId == testGroup.Key
                                            && i.Status != "Expired"
                                            && dueEmails.Contains(i.Email.Trim().ToLower()))
                                .ToListAsync(cancellationToken);

                            foreach (var invitation in invitations)
                                invitation.Status = "Expired";
                        }

                        expired += dueEmails.Count;
                        break;
                    }
                }
            }

            // For in-memory provider: Expire changes are tracked across all test groups — flush once here.
            if (action == "Expire" && !dbContext.Database.IsRelational())
            {
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            run.CandidatesAnonymized = anonymized;
            run.CandidatesDeleted = deleted;
            run.CandidatesExpired = expired;
            run.CandidatesProcessed = anonymized + deleted + expired;
            run.CompletedAtUtc = DateTime.UtcNow;

            settings.LastRunAtUtc = startedAt;
            dbContext.CandidateRetentionRuns.Add(run);
            await dbContext.SaveChangesAsync(cancellationToken);

            logger.LogInformation(
                "CandidateRetentionSweep | Action={Action} | Period={Period}d | Scanned={Scanned} | Anonymized={Anonymized} | Deleted={Deleted} | Expired={Expired} | TriggeredBy={TriggeredBy}",
                action,
                settings.RetentionPeriodDays,
                run.CandidatesScanned,
                anonymized,
                deleted,
                expired,
                triggeredBy);

            return MapRun(run);
        }
        finally
        {
            // Release the lock regardless of success or cancellation so other replicas are not blocked.
            await dbContext.CandidateRetentionSettings
                .Where(s => s.Id == RetentionSettingsId)
                .ExecuteUpdateAsync(
                    s => s.SetProperty(x => x.SweepLockedAtUtc, (DateTime?)null),
                    CancellationToken.None);
        }
    }

    private async Task<CandidateRetentionSettings> GetOrCreateSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await dbContext.CandidateRetentionSettings
            .FirstOrDefaultAsync(item => item.Id == RetentionSettingsId, cancellationToken);

        if (settings is null)
        {
            settings = await dbContext.CandidateRetentionSettings
                .OrderByDescending(item => item.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return settings ?? new CandidateRetentionSettings();
    }

    private async Task<int> CountPendingCandidatesAsync(
        CandidateRetentionSettings settings,
        CancellationToken cancellationToken)
    {
        if (!settings.Enabled || settings.RetentionPeriodDays <= 0)
        {
            return 0;
        }

        var cutoffUtc = DateTime.UtcNow.AddDays(-settings.RetentionPeriodDays);

        return await dbContext.CandidateInvitations
            .AsNoTracking()
            .Where(i => i.Status != "Expired" && i.Email != null && i.Email.Trim() != "")
            .Select(i => new
            {
                i.TestId,
                NormalizedEmail = i.Email.Trim().ToLower(),
                ActivityAt = i.AttemptSubmittedAtUtc ?? i.AttemptStartedAtUtc ?? (DateTime?)i.LastSentAtUtc ?? i.CreatedAt,
            })
            .GroupBy(i => new { i.TestId, i.NormalizedEmail })
            .Select(g => g.Max(i => i.ActivityAt))
            .CountAsync(latestActivity => latestActivity <= cutoffUtc, cancellationToken);
    }

    private static void ValidateSettings(UpdateCandidateRetentionSettingsDto request)
    {
        if (request.RetentionPeriodDays < 1)
        {
            throw new ApiException("RetentionPeriodDays must be at least 1.", StatusCodes.Status400BadRequest);
        }

        if (request.ScanIntervalHours < 1)
        {
            throw new ApiException("ScanIntervalHours must be at least 1.", StatusCodes.Status400BadRequest);
        }

        NormalizeAction(request.RetentionAction);
    }

    private static string NormalizeAction(string? action)
    {
        return action?.Trim() switch
        {
            "Anonymize" or "anonymize" => "Anonymize",
            "Delete" or "delete" => "Delete",
            "Expire" or "expire" => "Expire",
            _ => throw new ApiException("RetentionAction must be Anonymize, Delete, or Expire.", StatusCodes.Status400BadRequest),
        };
    }

    private static string NormalizeEmail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return value.Trim().ToLowerInvariant();
    }

    private static CandidateRetentionSettingsDto MapSettings(CandidateRetentionSettings settings)
    {
        return new CandidateRetentionSettingsDto
        {
            Enabled = settings.Enabled,
            RetentionAction = settings.RetentionAction,
            RetentionPeriodDays = settings.RetentionPeriodDays,
            ScanIntervalHours = settings.ScanIntervalHours,
            LastRunAtUtc = settings.LastRunAtUtc?.ToString("O"),
        };
    }

    private static CandidateRetentionRunDto MapRun(CandidateRetentionRun run)
    {
        return new CandidateRetentionRunDto
        {
            Id = run.Id.ToString(),
            TriggeredBy = run.TriggeredBy,
            TriggerSource = run.TriggerSource,
            RetentionAction = run.RetentionAction,
            RetentionPeriodDays = run.RetentionPeriodDays,
            CandidatesScanned = run.CandidatesScanned,
            CandidatesProcessed = run.CandidatesProcessed,
            CandidatesAnonymized = run.CandidatesAnonymized,
            CandidatesDeleted = run.CandidatesDeleted,
            CandidatesExpired = run.CandidatesExpired,
            StartedAtUtc = run.StartedAtUtc.ToString("O"),
            CompletedAtUtc = run.CompletedAtUtc?.ToString("O"),
        };
    }
}

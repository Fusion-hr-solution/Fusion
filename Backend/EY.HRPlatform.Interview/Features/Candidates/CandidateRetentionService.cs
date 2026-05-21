using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Candidates;
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

    public async Task<CandidateRetentionRunDto> RunRetentionSweepAsync(
        string triggeredBy,
        string triggerSource,
        CancellationToken cancellationToken)
    {
        var settings = await GetOrCreateSettingsAsync(cancellationToken);

        var startedAt = DateTime.UtcNow;
        var run = new CandidateRetentionRun
        {
            TriggeredBy = triggeredBy.Trim(),
            TriggerSource = triggerSource,
            RetentionAction = settings.RetentionAction,
            RetentionPeriodDays = settings.RetentionPeriodDays,
            StartedAtUtc = startedAt,
        };

        if (!settings.Enabled || settings.RetentionPeriodDays <= 0)
        {
            run.CompletedAtUtc = DateTime.UtcNow;
            dbContext.CandidateRetentionRuns.Add(run);
            settings.LastRunAtUtc = startedAt;
            await dbContext.SaveChangesAsync(cancellationToken);
            return MapRun(run);
        }

        var cutoffUtc = startedAt.AddDays(-settings.RetentionPeriodDays);
        var action = settings.RetentionAction;

        var allInvitations = await dbContext.CandidateInvitations
            .Where(item => item.Status != "Expired")
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);

        var groups = allInvitations
            .GroupBy(item => (item.TestId, Email: NormalizeEmail(item.Email)))
            .Where(group => !string.IsNullOrWhiteSpace(group.Key.Email))
            .ToList();

        run.CandidatesScanned = groups.Count;

        int anonymized = 0, deleted = 0, expired = 0;

        foreach (var group in groups)
        {
            var invitationList = group.ToList();
            var clock = invitationList
                .Select(item =>
                    item.AttemptSubmittedAtUtc
                    ?? item.AttemptStartedAtUtc
                    ?? (DateTime?)item.LastSentAtUtc
                    ?? item.CreatedAt)
                .Max();

            if (clock > cutoffUtc)
            {
                continue;
            }

            switch (action)
            {
                case "Anonymize":
                    await privacyExecutor.PseudonymizeAsync(
                        group.Key.TestId,
                        group.Key.Email,
                        "anonymize",
                        "RetentionJob",
                        "RetentionJob",
                        invitationList,
                        cancellationToken);
                    anonymized++;
                    break;

                case "Delete":
                    var invitationIds = invitationList.Select(item => item.Id).ToList();

                    if (dbContext.Database.IsRelational())
                    {
                        await dbContext.CandidateProgressEvents
                            .Where(item => invitationIds.Contains(item.InvitationId))
                            .ExecuteDeleteAsync(cancellationToken);
                        await dbContext.CandidateTestAttempts
                            .Where(item => invitationIds.Contains(item.InvitationId))
                            .ExecuteDeleteAsync(cancellationToken);
                        await dbContext.CandidateInvitations
                            .Where(item => invitationIds.Contains(item.Id))
                            .ExecuteDeleteAsync(cancellationToken);
                    }
                    else
                    {
                        var eventsToDelete = await dbContext.CandidateProgressEvents
                            .Where(item => invitationIds.Contains(item.InvitationId))
                            .ToListAsync(cancellationToken);
                        dbContext.CandidateProgressEvents.RemoveRange(eventsToDelete);

                        var attemptsToDelete = await dbContext.CandidateTestAttempts
                            .Where(item => invitationIds.Contains(item.InvitationId))
                            .ToListAsync(cancellationToken);
                        dbContext.CandidateTestAttempts.RemoveRange(attemptsToDelete);

                        dbContext.CandidateInvitations.RemoveRange(invitationList);
                        await dbContext.SaveChangesAsync(cancellationToken);
                    }

                    deleted++;
                    break;

                case "Expire":
                    foreach (var invitation in invitationList)
                    {
                        invitation.Status = "Expired";
                    }
                    await dbContext.SaveChangesAsync(cancellationToken);
                    expired++;
                    break;
            }
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

        var allInvitations = await dbContext.CandidateInvitations
            .AsNoTracking()
            .Where(item => item.Status != "Expired")
            .Select(item => new
            {
                item.Email,
                item.TestId,
                item.AttemptSubmittedAtUtc,
                item.AttemptStartedAtUtc,
                item.LastSentAtUtc,
                item.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        return allInvitations
            .GroupBy(item => (item.TestId, Email: NormalizeEmail(item.Email)))
            .Count(group =>
            {
                var latest = group
                    .Select(item =>
                        item.AttemptSubmittedAtUtc
                        ?? item.AttemptStartedAtUtc
                        ?? (DateTime?)item.LastSentAtUtc
                        ?? item.CreatedAt)
                    .Max();
                return latest <= cutoffUtc;
            });
    }

    private static void ValidateSettings(UpdateCandidateRetentionSettingsDto request)
    {
        if (request.RetentionPeriodDays < 1)
        {
            throw new ArgumentException("RetentionPeriodDays must be at least 1.");
        }

        if (request.ScanIntervalHours < 1)
        {
            throw new ArgumentException("ScanIntervalHours must be at least 1.");
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
            _ => throw new ArgumentException("RetentionAction must be Anonymize, Delete, or Expire."),
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

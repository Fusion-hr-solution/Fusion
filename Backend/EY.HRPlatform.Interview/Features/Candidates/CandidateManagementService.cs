using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Candidates;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.Candidates;

public class CandidateManagementService(
    AppDbContext dbContext,
    ICandidateInvitationService invitationService,
    ICandidateInvitationEmailSender emailSender,
    ICandidatePrivacyActionExecutor privacyExecutor,
    ICandidateRetentionService retentionService,
    IConfiguration configuration,
    ILogger<CandidateManagementService> logger)
    : ICandidateManagementService
{
    private const int DefaultTimelineEventRetentionDays = 90;
    private static readonly Guid AttemptSettingsId = Guid.Parse("1f8197d0-4b62-4b54-8ed9-7ebf2fb02a51");
    private const string PrivacyActionAnonymize = "anonymize";
    private const string PrivacyActionDeletePii = "delete-pii";

    public async Task<CandidateManagementOverviewDto> GetOverviewAsync(CancellationToken cancellationToken)
    {
        var pendingInvitations = await invitationService.GetPendingAsync(null, cancellationToken);
        var pendingCount = pendingInvitations.Count;
        var deliveryFailedCount = pendingInvitations.Count(item => IsStatus(item.Status, "DeliveryFailed"));

        var pendingDeletion = await retentionService.GetPendingCountAsync(cancellationToken);

        var overview = new CandidateManagementOverviewDto
        {
            PendingInvitations = pendingCount,
            DeliveryFailed = deliveryFailedCount,
            ExpiringLinks = 0,
            InProgressCandidates = 0,
            RetakeRequests = 0,
            PendingDeletion = pendingDeletion,
            GeneratedAtUtc = DateTime.UtcNow.ToString("O"),
        };

        return overview;
    }

    public async Task<IReadOnlyList<CandidateTimelineCandidateDto>> GetTimelineCandidatesAsync(
        string testId,
        CancellationToken cancellationToken)
    {
        var parsedTestId = ParseTestId(testId);
        await PurgeExpiredProgressEventsAsync(cancellationToken);

        var invitations = await dbContext.CandidateInvitations
            .AsNoTracking()
            .Where(item => item.TestId == parsedTestId && item.Status != "Expired")
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);

        var grouped = invitations
            .GroupBy(item => NormalizeStoredEmailForLookup(item.Email), StringComparer.Ordinal)
            .Where(group => !string.IsNullOrWhiteSpace(group.Key))
            .Select(group => group.OrderByDescending(item => item.CreatedAt).First())
            .OrderBy(item => NormalizeStoredEmailForLookup(item.Email))
            .ToList();

        return grouped
            .Select(item => new CandidateTimelineCandidateDto
            {
                CandidateEmail = NormalizeStoredEmailForLookup(item.Email),
                CandidateName = item.CandidateName,
                LatestStatus = item.Status,
                LatestActivityAtUtc = ResolveLatestActivityUtc(item),
            })
            .ToList();
    }

    public async Task<CandidateProgressTimelineDto> GetTimelineAsync(
        string testId,
        string candidateEmail,
        CancellationToken cancellationToken)
    {
        var parsedTestId = ParseTestId(testId);
        var normalizedCandidateEmail = NormalizeCandidateEmail(candidateEmail);
        await PurgeExpiredProgressEventsAsync(cancellationToken);

        var invitation = await FindLatestInvitationByNormalizedEmailAsync(
                parsedTestId,
                normalizedCandidateEmail,
                cancellationToken)
            ?? throw new ApiException("Candidate timeline not found.", StatusCodes.Status404NotFound);

        var events = await dbContext.CandidateProgressEvents
            .AsNoTracking()
            .Where(item => item.InvitationId == invitation.Id)
            .OrderBy(item => item.OccurredAtUtc)
            .ToListAsync(cancellationToken);

        var attemptNumbers = invitation.Attempts
            .Select(item => item.AttemptNumber)
            .Concat(events.Select(item => item.AttemptNumber))
            .Where(item => item > 0)
            .Distinct()
            .OrderBy(item => item)
            .ToList();

        if (attemptNumbers.Count == 0)
        {
            attemptNumbers.Add(1);
        }

        var attempts = new List<CandidateAttemptTimelineDto>(attemptNumbers.Count);
        foreach (var attemptNumber in attemptNumbers)
        {
            var attempt = invitation.Attempts
                .OrderByDescending(item => item.AttemptNumber)
                .ThenByDescending(item => item.CreatedAt)
                .FirstOrDefault(item => item.AttemptNumber == attemptNumber);

            var attemptEvents = events
                .Where(item => item.AttemptNumber == attemptNumber)
                .OrderBy(item => item.OccurredAtUtc)
                .ToList();

            var invitedAtUtc = attemptEvents
                .FirstOrDefault(item => item.Milestone == CandidateProgressMilestones.Invited)
                ?.OccurredAtUtc;
            var linkOpenedAtUtc = attemptEvents
                .FirstOrDefault(item => item.Milestone == CandidateProgressMilestones.LinkOpened)
                ?.OccurredAtUtc;
            var startedAtUtc = attemptEvents
                .FirstOrDefault(item => item.Milestone == CandidateProgressMilestones.Started)
                ?.OccurredAtUtc;

            if (!startedAtUtc.HasValue && attempt is not null && attempt.StartedAtUtc != default)
            {
                var hasAttemptProgressEvidence =
                    attempt.SubmittedAtUtc.HasValue ||
                    linkOpenedAtUtc.HasValue ||
                    attemptEvents.Any(item => item.Milestone == CandidateProgressMilestones.Submitted);

                if (hasAttemptProgressEvidence)
                {
                    startedAtUtc = attempt.StartedAtUtc;
                }
            }

            var submittedAtUtc = attempt?.SubmittedAtUtc;
            submittedAtUtc ??= attemptEvents
                .FirstOrDefault(item => item.Milestone == CandidateProgressMilestones.Submitted)
                ?.OccurredAtUtc;

            var inProgressAtUtc = startedAtUtc.HasValue
                ? startedAtUtc
                : null;

            var status = submittedAtUtc.HasValue
                ? "Submitted"
                : startedAtUtc.HasValue
                    ? "InProgress"
                    : attempt is not null
                        ? "PendingStart"
                        : "Invited";

            attempts.Add(new CandidateAttemptTimelineDto
            {
                AttemptNumber = attemptNumber,
                AttemptId = attempt?.Id.ToString(),
                Status = status,
                GradingStatus = attempt?.GradingStatus.ToString() ?? "Pending",
                TotalScore = attempt?.TotalScore,
                MaxScore = attempt?.MaxScore,
                Milestones =
                [
                    BuildMilestone(CandidateProgressMilestones.Invited, invitedAtUtc),
                    BuildMilestone(CandidateProgressMilestones.LinkOpened, linkOpenedAtUtc),
                    BuildMilestone(CandidateProgressMilestones.Started, startedAtUtc),
                    BuildMilestone(CandidateProgressMilestones.InProgress, inProgressAtUtc),
                    BuildMilestone(CandidateProgressMilestones.Submitted, submittedAtUtc),
                ],
            });
        }

        return new CandidateProgressTimelineDto
        {
            TestId = invitation.TestId.ToString(),
            TestTitle = invitation.TestTitle,
            CandidateEmail = NormalizeStoredEmailForLookup(invitation.Email),
            CandidateName = invitation.CandidateName,
            Attempts = attempts,
        };
    }

    public async Task<CandidateRetakeGrantResultDto> GrantRetakeAsync(
        GrantCandidateRetakeRequestDto request,
        CancellationToken cancellationToken)
    {
        var parsedTestId = ParseTestId(request.TestId);
        var normalizedCandidateEmail = NormalizeCandidateEmail(request.CandidateEmail);

        var invitation = await FindLatestTrackedInvitationByNormalizedEmailAsync(
                parsedTestId,
                normalizedCandidateEmail,
                cancellationToken)
            ?? throw new ApiException("Candidate invitation was not found.", StatusCodes.Status404NotFound);

        var effectiveMaxAttempts = await GetEffectiveMaxAttemptsAsync(parsedTestId, cancellationToken);
        if (CandidateAttemptPolicy.IsLimitReached(effectiveMaxAttempts, invitation.Attempts.Count))
        {
            throw new ApiException("Maximum attempts reached.", StatusCodes.Status409Conflict);
        }

        var settings = await GetEffectiveSettingsAsync(parsedTestId, cancellationToken);
        var nowUtc = DateTime.UtcNow;
        var token = GenerateToken();
        var linkValidity = CandidateLinkSecurityPolicy.ToLinkValidityDuration(
            settings.LinkValidForValue,
            settings.LinkValidForUnit);

        invitation.LinkExpiryHours = CandidateLinkSecurityPolicy.ToRoundedHours(linkValidity);
        invitation.InviteLink = BuildInviteLink(token);
        invitation.TokenHash = HashToken(token);
        invitation.TokenCreatedAtUtc = nowUtc;
        invitation.TokenExpiresAtUtc = nowUtc.Add(linkValidity);
        invitation.OpensCount = 0;
        invitation.AttemptStartedAtUtc = null;
        invitation.AttemptSubmittedAtUtc = null;
        invitation.VerifiedEmail = null;
        invitation.EmailVerifiedAtUtc = null;
        invitation.LockedIpAddress = null;
        invitation.AccessFingerprintHash = null;
        invitation.LastSentAtUtc = nowUtc;

        var nextAttemptNumber = invitation.Attempts.Count == 0
            ? 1
            : invitation.Attempts.Max(item => item.AttemptNumber) + 1;

        var pendingAttempt = new CandidateTestAttempt
        {
            InvitationId = invitation.Id,
            AttemptNumber = nextAttemptNumber,
            TestId = invitation.TestId,
            CandidateEmail = invitation.Email,
            CandidateName = invitation.CandidateName,
            StartedAtUtc = default,
            SubmittedAtUtc = null,
            AnswersJson = "{}",
            ResultJson = "{}",
        };

        dbContext.CandidateTestAttempts.Add(pendingAttempt);
        invitation.Attempts.Add(pendingAttempt);

        var notificationSent = false;
        if (request.SendNotification)
        {
            try
            {
                await emailSender.SendInvitationAsync(MapInvitationDto(invitation), cancellationToken);
                notificationSent = true;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (ApiException)
            {
                throw;
            }
            catch (SmtpException ex)
            {
                logger.LogWarning(
                    ex,
                    "Candidate retake notification failed (SMTP). InvitationId={InvitationId} | Email={Email}",
                    invitation.Id,
                    invitation.Email);
            }
            catch (Exception ex)
            {
                logger.LogWarning(
                    ex,
                    "Candidate retake notification failed (unexpected error). InvitationId={InvitationId} | Email={Email}",
                    invitation.Id,
                    invitation.Email);
            }
        }

        invitation.Status = notificationSent || !request.SendNotification
            ? "Invited"
            : "DeliveryFailed";

        dbContext.CandidateProgressEvents.Add(new CandidateProgressEvent
        {
            InvitationId = invitation.Id,
            TestId = invitation.TestId,
            CandidateEmail = invitation.Email,
            CandidateName = invitation.CandidateName,
            AttemptId = pendingAttempt.Id,
            AttemptNumber = nextAttemptNumber,
            Milestone = CandidateProgressMilestones.Invited,
            OccurredAtUtc = nowUtc,
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return new CandidateRetakeGrantResultDto
        {
            TestId = invitation.TestId.ToString(),
            CandidateEmail = NormalizeStoredEmailForLookup(invitation.Email),
            CandidateName = invitation.CandidateName ?? string.Empty,
            InvitationId = invitation.Id.ToString(),
            AttemptId = pendingAttempt.Id.ToString(),
            AttemptNumber = nextAttemptNumber,
            Status = "PendingStart",
            NotificationSent = notificationSent,
            InviteLink = invitation.InviteLink,
            TokenExpiresAtUtc = invitation.TokenExpiresAtUtc.ToString("O"),
        };
    }

    public async Task<CandidateAttemptSettingsDto> GetAttemptSettingsAsync(CancellationToken cancellationToken)
    {
        var settings = await dbContext.CandidateAttemptSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == AttemptSettingsId, cancellationToken);

        if (settings is null)
        {
            settings = await dbContext.CandidateAttemptSettings
                .AsNoTracking()
                .OrderByDescending(item => item.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
        }

        if (settings is null)
        {
            return new CandidateAttemptSettingsDto
            {
                DefaultMaxAttempts = CandidateAttemptPolicy.DefaultMaxAttempts,
            };
        }

        return MapAttemptSettings(settings);
    }

    public async Task<CandidateAttemptSettingsDto> SaveAttemptSettingsAsync(
        UpdateCandidateAttemptSettingsDto request,
        CancellationToken cancellationToken)
    {
        var normalized = NormalizeAttemptSettings(request);

        var settings = await dbContext.CandidateAttemptSettings
            .FirstOrDefaultAsync(item => item.Id == AttemptSettingsId, cancellationToken);

        if (settings is null)
        {
            settings = new CandidateAttemptSettings();
            // Force singleton key without exposing a public setter on the entity.
            dbContext.Entry(settings).Property(item => item.Id).CurrentValue = AttemptSettingsId;
            dbContext.CandidateAttemptSettings.Add(settings);
        }

        settings.DefaultMaxAttempts = normalized.DefaultMaxAttempts;
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            dbContext.ChangeTracker.Clear();
            var reloaded = await dbContext.CandidateAttemptSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == AttemptSettingsId, cancellationToken);
            if (reloaded is null)
            {
                throw;
            }

            return MapAttemptSettings(reloaded);
        }

        return MapAttemptSettings(settings);
    }

    public async Task<CandidatePrivacyActionResultDto> ApplyPrivacyActionAsync(
        CandidatePrivacyActionRequestDto request,
        CancellationToken cancellationToken)
    {
        var parsedTestId = ParseTestId(request.TestId);
        var action = NormalizePrivacyAction(request.Action);
        var adminId = NormalizeAdminId(request.AdminId);
        var triggerSource = NormalizeTriggerSource(request.TriggerSource);

        var (invitations, normalizedEmail) = await ResolvePrivacyInvitationsAsync(
            parsedTestId,
            request.CandidateEmail,
            request.InvitationId,
            cancellationToken);

        return await privacyExecutor.PseudonymizeAsync(
            parsedTestId,
            normalizedEmail,
            action,
            adminId,
            triggerSource,
            invitations,
            cancellationToken);
    }

    public async Task<IReadOnlyList<CandidatePrivacyActionResultDto>> ApplyPrivacyActionBatchAsync(
        CandidatePrivacyActionBatchRequestDto request,
        CancellationToken cancellationToken)
    {
        var parsedTestId = ParseTestId(request.TestId);
        var action = NormalizePrivacyAction(request.Action);
        var adminId = NormalizeAdminId(request.AdminId);
        var triggerSource = NormalizeTriggerSource(request.TriggerSource);

        var normalizedEmails = new HashSet<string>(StringComparer.Ordinal);
        foreach (var email in request.CandidateEmails ?? [])
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                continue;
            }

            normalizedEmails.Add(NormalizeCandidateEmail(email));
        }

        foreach (var invitationId in request.InvitationIds ?? [])
        {
            if (string.IsNullOrWhiteSpace(invitationId))
            {
                continue;
            }

            if (!Guid.TryParse(invitationId, out var parsedInvitationId))
            {
                throw new ApiException("Valid invitationId is required.", StatusCodes.Status400BadRequest);
            }

            var invitation = await dbContext.CandidateInvitations
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == parsedInvitationId, cancellationToken);

            if (invitation is null || invitation.TestId != parsedTestId)
            {
                throw new ApiException("Candidate invitation was not found.", StatusCodes.Status404NotFound);
            }

            var normalizedEmail = NormalizeStoredEmailForLookup(invitation.Email);
            if (!string.IsNullOrWhiteSpace(normalizedEmail))
            {
                normalizedEmails.Add(normalizedEmail);
            }
        }

        if (normalizedEmails.Count == 0)
        {
            throw new ApiException(
                "Provide at least one candidateEmail or invitationId.",
                StatusCodes.Status400BadRequest);
        }

        var results = new List<CandidatePrivacyActionResultDto>(normalizedEmails.Count);
        foreach (var normalizedEmail in normalizedEmails)
        {
            var invitations = await FindTrackedInvitationsByNormalizedEmailAsync(
                parsedTestId,
                normalizedEmail,
                cancellationToken);

            if (invitations.Count == 0)
            {
                throw new ApiException("Candidate invitation was not found.", StatusCodes.Status404NotFound);
            }

            var result = await privacyExecutor.PseudonymizeAsync(
                parsedTestId,
                normalizedEmail,
                action,
                adminId,
                triggerSource,
                invitations,
                cancellationToken);
            results.Add(result);
        }

        return results;
    }

    private async Task<CandidateInvitation?> FindLatestInvitationByNormalizedEmailAsync(
        Guid testId,
        string normalizedCandidateEmail,
        CancellationToken cancellationToken)
    {
        var invitationQuery = dbContext.CandidateInvitations
            .AsNoTracking()
            .Include(item => item.Attempts)
            .Where(item => item.TestId == testId);

        var directMatch = await invitationQuery
            .Where(item => item.Email.Trim().ToLower() == normalizedCandidateEmail)
            .OrderByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (directMatch is not null)
        {
            return directMatch;
        }

        // Some legacy rows may contain non-space outer whitespace (for example tabs/newlines)
        // that SQL TRIM does not remove by default, so retry with in-memory normalization.
        var invitations = await invitationQuery
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);

        return invitations.FirstOrDefault(item =>
            NormalizeStoredEmailForLookup(item.Email) == normalizedCandidateEmail);
    }

    private async Task<CandidateInvitation?> FindLatestTrackedInvitationByNormalizedEmailAsync(
        Guid testId,
        string normalizedCandidateEmail,
        CancellationToken cancellationToken)
    {
        var invitationQuery = dbContext.CandidateInvitations
            .Include(item => item.Attempts)
            .Where(item => item.TestId == testId);

        var directMatch = await invitationQuery
            .Where(item => item.Email.Trim().ToLower() == normalizedCandidateEmail)
            .OrderByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (directMatch is not null)
        {
            return directMatch;
        }

        var invitations = await invitationQuery
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);

        return invitations.FirstOrDefault(item =>
            NormalizeStoredEmailForLookup(item.Email) == normalizedCandidateEmail);
    }

    public Task<CandidateLinkSecurityStateDto> GetLinkSecurityAsync(
        string testId,
        CancellationToken cancellationToken)
    {
        var parsedTestId = ParseTestId(testId);
        return BuildLinkSecurityStateAsync(parsedTestId, cancellationToken);
    }

    public async Task<CandidateLinkSecurityStateDto> SaveLinkSecurityAsync(
        UpdateCandidateLinkSecuritySettingsDto request,
        CancellationToken cancellationToken)
    {
        var parsedTestId = ParseTestId(request.TestId);
        await EnsureTestExistsAsync(parsedTestId, cancellationToken);

        var normalizedSettings = NormalizeSettings(request);
        var settingsEntity = await dbContext.CandidateLinkSecuritySettings
            .FirstOrDefaultAsync(item => item.TestId == parsedTestId, cancellationToken);

        if (settingsEntity is null)
        {
            settingsEntity = new CandidateLinkSecuritySettings
            {
                TestId = parsedTestId,
            };
            dbContext.CandidateLinkSecuritySettings.Add(settingsEntity);
        }

        settingsEntity.SingleUseLinkEnabled = normalizedSettings.SingleUseLinkEnabled;
        settingsEntity.EmailVerificationEnabled = normalizedSettings.EmailVerificationEnabled;
        settingsEntity.IpLockEnabled = normalizedSettings.IpLockEnabled;
        settingsEntity.BrowserFingerprintEnabled = normalizedSettings.BrowserFingerprintEnabled;
        settingsEntity.LinkValidForValue = normalizedSettings.LinkValidForValue;
        settingsEntity.LinkValidForUnit = normalizedSettings.LinkValidForUnit;
        settingsEntity.GracePeriodValue = normalizedSettings.GracePeriodValue;
        settingsEntity.GracePeriodUnit = normalizedSettings.GracePeriodUnit;

        await ApplyLinkValidityToPendingInvitationsAsync(parsedTestId, normalizedSettings, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return await BuildLinkSecurityStateAsync(parsedTestId, cancellationToken);
    }

    public async Task<CandidateLinkSecurityStateDto> RegenerateLinkAsync(
        string testId,
        CancellationToken cancellationToken)
    {
        var parsedTestId = ParseTestId(testId);
        await EnsureTestExistsAsync(parsedTestId, cancellationToken);
        var settings = await GetEffectiveSettingsAsync(parsedTestId, cancellationToken);

        var invitation = await dbContext.CandidateInvitations
            .Where(item =>
                item.TestId == parsedTestId &&
                (item.Status == "Invited" || item.Status == "DeliveryFailed"))
            .OrderByDescending(item => item.LastSentAtUtc)
            .ThenByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (invitation is null)
        {
            throw new ApiException(
                "No active invitation was found for the selected test. Send an invitation first.",
                StatusCodes.Status404NotFound);
        }

        var effectiveMaxAttempts = await GetEffectiveMaxAttemptsAsync(parsedTestId, cancellationToken);
        var attemptCount = await GetAttemptCountAsync(invitation.Id, cancellationToken);
        if (CandidateAttemptPolicy.IsLimitReached(effectiveMaxAttempts, attemptCount))
        {
            throw new ApiException("Maximum attempts reached.", StatusCodes.Status409Conflict);
        }

        var nowUtc = DateTime.UtcNow;
        var token = GenerateToken();
        var linkValidity = CandidateLinkSecurityPolicy.ToLinkValidityDuration(
            settings.LinkValidForValue,
            settings.LinkValidForUnit);

        invitation.LinkExpiryHours = CandidateLinkSecurityPolicy.ToRoundedHours(linkValidity);
        invitation.InviteLink = BuildInviteLink(token);
        invitation.TokenHash = HashToken(token);
        invitation.TokenCreatedAtUtc = nowUtc;
        invitation.TokenExpiresAtUtc = nowUtc.Add(linkValidity);
        invitation.OpensCount = 0;
        invitation.AttemptStartedAtUtc = null;
        invitation.AttemptSubmittedAtUtc = null;
        invitation.VerifiedEmail = null;
        invitation.EmailVerifiedAtUtc = null;
        invitation.LockedIpAddress = null;
        invitation.AccessFingerprintHash = null;

        var nextAttemptNumber = await dbContext.CandidateTestAttempts
            .Where(item => item.InvitationId == invitation.Id)
            .Select(item => (int?)item.AttemptNumber)
            .MaxAsync(cancellationToken) ?? 0;
        nextAttemptNumber += 1;

        dbContext.CandidateProgressEvents.Add(new CandidateProgressEvent
        {
            InvitationId = invitation.Id,
            TestId = invitation.TestId,
            CandidateEmail = invitation.Email,
            CandidateName = invitation.CandidateName,
            AttemptNumber = nextAttemptNumber,
            Milestone = CandidateProgressMilestones.Invited,
            OccurredAtUtc = nowUtc,
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return await BuildLinkSecurityStateAsync(parsedTestId, cancellationToken);
    }

    private async Task<CandidateLinkSecurityStateDto> BuildLinkSecurityStateAsync(
        Guid testId,
        CancellationToken cancellationToken)
    {
        var test = await dbContext.Tests
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == testId, cancellationToken)
            ?? throw new ApiException("Test not found.", StatusCodes.Status404NotFound);

        var settings = await GetEffectiveSettingsAsync(testId, cancellationToken);

        var previewInvitation = await dbContext.CandidateInvitations
            .AsNoTracking()
            .Where(item => item.TestId == testId)
            .OrderByDescending(item => item.LastSentAtUtc)
            .ThenByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return new CandidateLinkSecurityStateDto
        {
            TestId = test.Id.ToString(),
            TestTitle = test.Title,
            Settings = settings,
            Preview = MapPreview(previewInvitation, settings),
        };
    }

    private async Task<CandidateLinkSecuritySettingsDto> GetEffectiveSettingsAsync(
        Guid testId,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.CandidateLinkSecuritySettings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.TestId == testId, cancellationToken);

        if (settings is null)
        {
            return new CandidateLinkSecuritySettingsDto
            {
                SingleUseLinkEnabled = true,
                EmailVerificationEnabled = true,
                IpLockEnabled = false,
                BrowserFingerprintEnabled = false,
                LinkValidForValue = CandidateLinkSecurityPolicy.DefaultLinkValidForValue,
                LinkValidForUnit = CandidateLinkSecurityPolicy.DefaultLinkValidForUnit,
                GracePeriodValue = CandidateLinkSecurityPolicy.DefaultGracePeriodValue,
                GracePeriodUnit = CandidateLinkSecurityPolicy.DefaultGracePeriodUnit,
            };
        }

        return MapSettings(settings);
    }

    private async Task ApplyLinkValidityToPendingInvitationsAsync(
        Guid testId,
        CandidateLinkSecuritySettingsDto settings,
        CancellationToken cancellationToken)
    {
        var linkValidity = CandidateLinkSecurityPolicy.ToLinkValidityDuration(
            settings.LinkValidForValue,
            settings.LinkValidForUnit);
        var roundedHours = CandidateLinkSecurityPolicy.ToRoundedHours(linkValidity);

        var invitations = await dbContext.CandidateInvitations
            .Where(item =>
                item.TestId == testId &&
                (item.Status == "Invited" || item.Status == "DeliveryFailed"))
            .ToListAsync(cancellationToken);

        foreach (var invitation in invitations)
        {
            invitation.LinkExpiryHours = roundedHours;
            invitation.TokenExpiresAtUtc = invitation.TokenCreatedAtUtc.Add(linkValidity);
        }
    }

    private async Task<int> GetAttemptCountAsync(Guid invitationId, CancellationToken cancellationToken)
    {
        return await dbContext.CandidateTestAttempts
            .CountAsync(item => item.InvitationId == invitationId, cancellationToken);
    }

    private async Task<int> GetEffectiveMaxAttemptsAsync(Guid testId, CancellationToken cancellationToken)
    {
        var test = await dbContext.Tests
            .AsNoTracking()
            .Where(item => item.Id == testId)
            .Select(item => new { item.MaxAttempts })
            .FirstOrDefaultAsync(cancellationToken);

        if (test is null)
        {
            throw new ApiException("Test not found.", StatusCodes.Status404NotFound);
        }

        var globalDefault = await GetGlobalDefaultMaxAttemptsAsync(cancellationToken);
        return CandidateAttemptPolicy.ResolveEffectiveMaxAttempts(test.MaxAttempts, globalDefault);
    }

    private async Task<int> GetGlobalDefaultMaxAttemptsAsync(CancellationToken cancellationToken)
    {
        var settings = await dbContext.CandidateAttemptSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == AttemptSettingsId, cancellationToken);

        if (settings is null)
        {
            settings = await dbContext.CandidateAttemptSettings
                .AsNoTracking()
                .OrderByDescending(item => item.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
        }

        return settings?.DefaultMaxAttempts ?? CandidateAttemptPolicy.DefaultMaxAttempts;
    }

    private static CandidateAttemptSettingsDto MapAttemptSettings(CandidateAttemptSettings settings)
    {
        return new CandidateAttemptSettingsDto
        {
            DefaultMaxAttempts = settings.DefaultMaxAttempts,
        };
    }

    private static CandidateAttemptSettingsDto NormalizeAttemptSettings(UpdateCandidateAttemptSettingsDto request)
    {
        if (request.DefaultMaxAttempts < 0)
        {
            throw new ApiException(
                "defaultMaxAttempts must be 0 or greater.",
                StatusCodes.Status400BadRequest);
        }

        return new CandidateAttemptSettingsDto
        {
            DefaultMaxAttempts = request.DefaultMaxAttempts,
        };
    }

    private async Task<(IReadOnlyList<CandidateInvitation> Invitations, string NormalizedEmail)>
        ResolvePrivacyInvitationsAsync(
            Guid testId,
            string? candidateEmail,
            string? invitationId,
            CancellationToken cancellationToken)
    {
        string normalizedEmail;

        if (!string.IsNullOrWhiteSpace(invitationId))
        {
            if (!Guid.TryParse(invitationId, out var parsedInvitationId))
            {
                throw new ApiException("Valid invitationId is required.", StatusCodes.Status400BadRequest);
            }

            var invitation = await dbContext.CandidateInvitations
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == parsedInvitationId, cancellationToken);

            if (invitation is null || invitation.TestId != testId)
            {
                throw new ApiException("Candidate invitation was not found.", StatusCodes.Status404NotFound);
            }

            normalizedEmail = NormalizeStoredEmailForLookup(invitation.Email);
            if (string.IsNullOrWhiteSpace(normalizedEmail))
            {
                throw new ApiException("Candidate email was not found for the invitation.", StatusCodes.Status400BadRequest);
            }
        }
        else if (!string.IsNullOrWhiteSpace(candidateEmail))
        {
            normalizedEmail = NormalizeCandidateEmail(candidateEmail);
        }
        else
        {
            throw new ApiException(
                "Provide candidateEmail or invitationId.",
                StatusCodes.Status400BadRequest);
        }

        var invitations = await FindTrackedInvitationsByNormalizedEmailAsync(
            testId,
            normalizedEmail,
            cancellationToken);

        if (invitations.Count == 0)
        {
            throw new ApiException("Candidate invitation was not found.", StatusCodes.Status404NotFound);
        }

        return (invitations, normalizedEmail);
    }

    private async Task<IReadOnlyList<CandidateInvitation>> FindTrackedInvitationsByNormalizedEmailAsync(
        Guid testId,
        string normalizedCandidateEmail,
        CancellationToken cancellationToken)
    {
        var invitationQuery = dbContext.CandidateInvitations
            .Where(item => item.TestId == testId);

        var directMatches = await invitationQuery
            .Where(item => item.Email.Trim().ToLower() == normalizedCandidateEmail)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);

        if (directMatches.Count > 0)
        {
            return directMatches;
        }

        var invitations = await invitationQuery
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);

        return invitations
            .Where(item => NormalizeStoredEmailForLookup(item.Email) == normalizedCandidateEmail)
            .ToList();
    }

    private static string NormalizePrivacyAction(string? action)
    {
        var normalized = action?.Trim().ToLowerInvariant();
        return normalized switch
        {
            PrivacyActionAnonymize => PrivacyActionAnonymize,
            PrivacyActionDeletePii => PrivacyActionDeletePii,
            "delete" => PrivacyActionDeletePii,
            "deletepii" => PrivacyActionDeletePii,
            _ => throw new ApiException(
                "Valid action is required. Use 'anonymize' or 'delete-pii'.",
                StatusCodes.Status400BadRequest)
        };
    }

    private static string NormalizeAdminId(string? adminId)
    {
        var normalized = adminId?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            throw new ApiException("Valid adminId is required.", StatusCodes.Status400BadRequest);
        }

        return normalized;
    }

    private static string NormalizeTriggerSource(string? triggerSource)
    {
        return string.IsNullOrWhiteSpace(triggerSource)
            ? "UI"
            : triggerSource.Trim();
    }

    private async Task EnsureTestExistsAsync(Guid testId, CancellationToken cancellationToken)
    {
        var exists = await dbContext.Tests
            .AsNoTracking()
            .AnyAsync(item => item.Id == testId, cancellationToken);

        if (!exists)
        {
            throw new ApiException("Test not found.", StatusCodes.Status404NotFound);
        }
    }

    private static CandidateLinkSecuritySettingsDto NormalizeSettings(UpdateCandidateLinkSecuritySettingsDto request)
    {
        if (request.LinkValidForValue <= 0)
        {
            throw new ApiException(
                "linkValidForValue must be greater than 0.",
                StatusCodes.Status400BadRequest);
        }

        if (request.GracePeriodValue <= 0)
        {
            throw new ApiException(
                "gracePeriodValue must be greater than 0.",
                StatusCodes.Status400BadRequest);
        }

        string normalizedLinkUnit;
        string normalizedGraceUnit;

        try
        {
            normalizedLinkUnit = CandidateLinkSecurityPolicy.NormalizeLinkValidityUnit(request.LinkValidForUnit);
        }
        catch (ArgumentException)
        {
            throw new ApiException(
                "linkValidForUnit must be one of: days, hours, minutes.",
                StatusCodes.Status400BadRequest);
        }

        try
        {
            normalizedGraceUnit = CandidateLinkSecurityPolicy.NormalizeGracePeriodUnit(request.GracePeriodUnit);
        }
        catch (ArgumentException)
        {
            throw new ApiException(
                "gracePeriodUnit must be one of: minutes, hours.",
                StatusCodes.Status400BadRequest);
        }

        var linkValidity = CandidateLinkSecurityPolicy.ToLinkValidityDuration(request.LinkValidForValue, normalizedLinkUnit);
        if (linkValidity.TotalHours > CandidateLinkSecurityPolicy.MaxLinkValidityHours)
        {
            throw new ApiException(
                $"link validity cannot exceed {CandidateLinkSecurityPolicy.MaxLinkValidityHours} hours.",
                StatusCodes.Status400BadRequest);
        }

        var gracePeriod = CandidateLinkSecurityPolicy.ToGracePeriodDuration(request.GracePeriodValue, normalizedGraceUnit);
        if (gracePeriod.TotalHours > CandidateLinkSecurityPolicy.MaxGracePeriodHours)
        {
            throw new ApiException(
                $"grace period cannot exceed {CandidateLinkSecurityPolicy.MaxGracePeriodHours} hours.",
                StatusCodes.Status400BadRequest);
        }

        return new CandidateLinkSecuritySettingsDto
        {
            SingleUseLinkEnabled = request.SingleUseLinkEnabled,
            EmailVerificationEnabled = request.EmailVerificationEnabled,
            IpLockEnabled = request.IpLockEnabled,
            BrowserFingerprintEnabled = request.BrowserFingerprintEnabled,
            LinkValidForValue = request.LinkValidForValue,
            LinkValidForUnit = normalizedLinkUnit,
            GracePeriodValue = request.GracePeriodValue,
            GracePeriodUnit = normalizedGraceUnit,
        };
    }

    private static CandidateLinkSecuritySettingsDto MapSettings(CandidateLinkSecuritySettings settings)
    {
        return new CandidateLinkSecuritySettingsDto
        {
            SingleUseLinkEnabled = settings.SingleUseLinkEnabled,
            EmailVerificationEnabled = settings.EmailVerificationEnabled,
            IpLockEnabled = settings.IpLockEnabled,
            BrowserFingerprintEnabled = settings.BrowserFingerprintEnabled,
            LinkValidForValue = settings.LinkValidForValue,
            LinkValidForUnit = settings.LinkValidForUnit,
            GracePeriodValue = settings.GracePeriodValue,
            GracePeriodUnit = settings.GracePeriodUnit,
        };
    }

    private static CandidateLinkPreviewDto MapPreview(
        CandidateInvitation? invitation,
        CandidateLinkSecuritySettingsDto settings)
    {
        var securityLevel = CandidateLinkSecurityPolicy.BuildSecurityLevel(
            settings.SingleUseLinkEnabled,
            settings.EmailVerificationEnabled,
            settings.IpLockEnabled,
            settings.BrowserFingerprintEnabled);

        if (invitation is null)
        {
            return new CandidateLinkPreviewDto
            {
                HasInvitation = false,
                AllowedUses = settings.SingleUseLinkEnabled ? 1 : null,
                SecurityLevel = securityLevel,
            };
        }

        return new CandidateLinkPreviewDto
        {
            HasInvitation = true,
            InvitationId = invitation.Id.ToString(),
            InviteLink = invitation.InviteLink,
            OpensCount = invitation.OpensCount,
            AllowedUses = settings.SingleUseLinkEnabled ? 1 : null,
            TokenExpiresAtUtc = invitation.TokenExpiresAtUtc.ToString("O"),
            SecurityLevel = securityLevel,
        };
    }

    private static Guid ParseTestId(string testId)
    {
        if (!Guid.TryParse(testId, out var parsedTestId))
        {
            throw new ApiException("Valid testId is required.", StatusCodes.Status400BadRequest);
        }

        return parsedTestId;
    }

    private static bool IsStatus(string? value, string expected)
    {
        return string.Equals(value?.Trim(), expected, StringComparison.OrdinalIgnoreCase);
    }

    private async Task PurgeExpiredProgressEventsAsync(CancellationToken cancellationToken)
    {
        var retentionDays = configuration.GetValue<int?>("CandidateTimeline:EventRetentionDays")
            ?? DefaultTimelineEventRetentionDays;

        if (retentionDays <= 0)
        {
            return;
        }

        var cutoffUtc = DateTime.UtcNow.AddDays(-retentionDays);

        if (dbContext.Database.IsRelational())
        {
            await dbContext.CandidateProgressEvents
                .Where(item => item.OccurredAtUtc < cutoffUtc)
                .ExecuteDeleteAsync(cancellationToken);
            return;
        }

        var staleEvents = await dbContext.CandidateProgressEvents
            .Where(item => item.OccurredAtUtc < cutoffUtc)
            .ToListAsync(cancellationToken);

        if (staleEvents.Count == 0)
        {
            return;
        }

        dbContext.CandidateProgressEvents.RemoveRange(staleEvents);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static CandidateTimelineMilestoneDto BuildMilestone(string name, DateTime? occurredAtUtc)
    {
        return new CandidateTimelineMilestoneDto
        {
            Name = name,
            State = occurredAtUtc.HasValue ? "Completed" : "Pending",
            OccurredAtUtc = occurredAtUtc?.ToString("O"),
        };
    }

    private static string NormalizeCandidateEmail(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        if (!normalized.Contains('@'))
        {
            throw new ApiException("Valid candidateEmail is required.", StatusCodes.Status400BadRequest);
        }

        return normalized;
    }

    private static string NormalizeStoredEmailForLookup(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return value.Trim().ToLowerInvariant();
    }

    private static string? ResolveLatestActivityUtc(CandidateInvitation invitation)
    {
        var latest = invitation.AttemptSubmittedAtUtc
            ?? invitation.AttemptStartedAtUtc
            ?? invitation.LastSentAtUtc;

        return latest.ToString("O");
    }

    private static CandidateInvitationDto MapInvitationDto(CandidateInvitation invitation)
    {
        return new CandidateInvitationDto
        {
            Id = invitation.Id.ToString(),
            TestId = invitation.TestId.ToString(),
            TestTitle = invitation.TestTitle,
            Email = invitation.Email,
            CandidateName = invitation.CandidateName,
            Status = invitation.Status,
            DeadlineUtc = invitation.DeadlineUtc?.ToString("O"),
            InviteMethod = invitation.InviteMethod,
            LinkExpiryHours = invitation.LinkExpiryHours,
            TokenCreatedAtUtc = invitation.TokenCreatedAtUtc.ToString("O"),
            TokenExpiresAtUtc = invitation.TokenExpiresAtUtc.ToString("O"),
            TimeLimitMinutes = invitation.TimeLimitMinutes,
            CustomMessage = invitation.CustomMessage,
            InviteLink = invitation.InviteLink,
            CreatedAtUtc = invitation.CreatedAt.ToString("O"),
            LastSentAtUtc = invitation.LastSentAtUtc.ToString("O"),
            ResendCount = invitation.ResendCount,
            OpensCount = invitation.OpensCount,
        };
    }

    private string BuildInviteLink(string token)
    {
        var baseUrl = configuration["CandidateInvitations:PublicBaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            baseUrl = "http://localhost:3000/interview/candidate/start";
        }

        return $"{baseUrl}?token={token}";
    }

    private static string GenerateToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static string HashToken(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

}

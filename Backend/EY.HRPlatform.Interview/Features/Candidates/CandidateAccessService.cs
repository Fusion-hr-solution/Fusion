using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Candidates;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.Candidates;

public class CandidateAccessService(AppDbContext dbContext) : ICandidateAccessService
{
    public async Task<CandidateAccessValidationDto> ValidateAsync(string token, CancellationToken cancellationToken)
    {
        var normalizedToken = NormalizeToken(token);
        var invitation = await FindInvitationByTokenAsync(normalizedToken, includeQuestions: false, cancellationToken);
        if (invitation is null)
        {
            return new CandidateAccessValidationDto
            {
                IsValid = false,
                Status = "Invalid",
                Message = "Invitation link is invalid."
            };
        }

        var settings = await GetEffectiveSettingsAsync(invitation.TestId, cancellationToken);

        var nowUtc = DateTime.UtcNow;
        var state = ResolveState(invitation, settings, nowUtc);
        var activeAttempt = GetActiveAttempt(invitation);
        var effectiveMaxAttempts = await GetEffectiveMaxAttemptsAsync(invitation.TestId, cancellationToken);
        var attemptLimitReached = activeAttempt is null &&
            CandidateAttemptPolicy.IsLimitReached(effectiveMaxAttempts, invitation.Attempts.Count);

        var reusableSubmittedState = !settings.SingleUseLinkEnabled &&
            state == InvitationAccessState.Submitted &&
            !attemptLimitReached;

        // Count link opens when the invite page is loaded (validate endpoint).
        if (state is InvitationAccessState.Invited or InvitationAccessState.InProgress || reusableSubmittedState)
        {
            invitation.OpensCount += 1;

            var attemptNumber = activeAttempt?.AttemptNumber ?? GetNextAttemptNumber(invitation);

            dbContext.CandidateProgressEvents.Add(new CandidateProgressEvent
            {
                InvitationId = invitation.Id,
                TestId = invitation.TestId,
                CandidateEmail = invitation.Email,
                CandidateName = invitation.CandidateName,
                AttemptId = activeAttempt?.Id,
                AttemptNumber = attemptNumber,
                Milestone = CandidateProgressMilestones.LinkOpened,
                OccurredAtUtc = nowUtc,
            });

            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return MapValidationDto(invitation, state, nowUtc, settings, attemptLimitReached);
    }

    public async Task<CandidateAccessSessionDto> StartOrResumeAsync(
        StartCandidateAttemptDto request,
        CancellationToken cancellationToken)
    {
        var normalizedToken = NormalizeToken(request.Token);
        var invitation = await FindInvitationByTokenAsync(normalizedToken, includeQuestions: true, cancellationToken)
            ?? throw new ApiException("Invitation link is invalid.", StatusCodes.Status404NotFound);

        var settings = await GetEffectiveSettingsAsync(invitation.TestId, cancellationToken);

        var nowUtc = DateTime.UtcNow;
        var state = ResolveState(invitation, settings, nowUtc);

        if (state == InvitationAccessState.Expired)
        {
            throw new ApiException(
                BuildExpiredMessage(invitation, settings, nowUtc),
                StatusCodes.Status410Gone);
        }

        if (state == InvitationAccessState.Submitted)
        {
            if (settings.SingleUseLinkEnabled)
            {
                throw new ApiException(
                    "This invitation link was already used for a submitted attempt.",
                    StatusCodes.Status409Conflict);
            }
        }

        if (settings.SingleUseLinkEnabled && state == InvitationAccessState.InProgress)
        {
            throw new ApiException(
                "This single-use invitation link has already been opened.",
                StatusCodes.Status409Conflict);
        }

        EnforceEmailVerification(invitation, request.CandidateEmail, settings, nowUtc);

        var attempt = GetActiveAttempt(invitation);
        if (attempt is null)
        {
            var effectiveMaxAttempts = await GetEffectiveMaxAttemptsAsync(invitation.TestId, cancellationToken);
            if (CandidateAttemptPolicy.IsLimitReached(effectiveMaxAttempts, invitation.Attempts.Count))
            {
                throw new ApiException("Maximum attempts reached.", StatusCodes.Status409Conflict);
            }
        }

        var metadata = BuildAccessMetadata(
            request.ClientIpAddress,
            request.BrowserFingerprint,
            request.UserAgent);

        await ApplyAndValidateAccessLocksAsync(invitation, metadata, settings, cancellationToken);
        var startedFromPendingAttempt = false;
        if (attempt is null)
        {
            var nextAttemptNumber = GetNextAttemptNumber(invitation);

            attempt = new CandidateTestAttempt
            {
                InvitationId = invitation.Id,
                AttemptNumber = nextAttemptNumber,
                TestId = invitation.TestId,
                CandidateEmail = invitation.Email,
                CandidateName = invitation.CandidateName,
                StartedAtUtc = nowUtc,
                SubmittedAtUtc = null,
                AnswersJson = "{}",
                ResultJson = "{}"
            };

            dbContext.CandidateTestAttempts.Add(attempt);
            invitation.Attempts.Add(attempt);

            dbContext.CandidateProgressEvents.Add(new CandidateProgressEvent
            {
                InvitationId = invitation.Id,
                TestId = invitation.TestId,
                CandidateEmail = invitation.Email,
                CandidateName = invitation.CandidateName,
                AttemptId = attempt.Id,
                AttemptNumber = attempt.AttemptNumber,
                Milestone = CandidateProgressMilestones.Started,
                OccurredAtUtc = nowUtc,
                ClientIpAddress = metadata.ClientIpAddress,
                BrowserFingerprintHash = metadata.FingerprintHash,
                UserAgent = request.UserAgent,
            });
        }

        if (attempt.StartedAtUtc == default)
        {
            attempt.StartedAtUtc = nowUtc;
            startedFromPendingAttempt = true;
        }

        if (startedFromPendingAttempt)
        {
            dbContext.CandidateProgressEvents.Add(new CandidateProgressEvent
            {
                InvitationId = invitation.Id,
                TestId = invitation.TestId,
                CandidateEmail = invitation.Email,
                CandidateName = invitation.CandidateName,
                AttemptId = attempt.Id,
                AttemptNumber = attempt.AttemptNumber,
                Milestone = CandidateProgressMilestones.Started,
                OccurredAtUtc = nowUtc,
                ClientIpAddress = metadata.ClientIpAddress,
                BrowserFingerprintHash = metadata.FingerprintHash,
                UserAgent = request.UserAgent,
            });
        }

        invitation.AttemptStartedAtUtc = attempt.StartedAtUtc;
        invitation.AttemptSubmittedAtUtc = null;

        // Keep first direct start counted if a client bypasses validate.
        if (state == InvitationAccessState.Invited && invitation.OpensCount == 0)
        {
            invitation.OpensCount = 1;

            dbContext.CandidateProgressEvents.Add(new CandidateProgressEvent
            {
                InvitationId = invitation.Id,
                TestId = invitation.TestId,
                CandidateEmail = invitation.Email,
                CandidateName = invitation.CandidateName,
                AttemptId = attempt.Id,
                AttemptNumber = attempt.AttemptNumber,
                Milestone = CandidateProgressMilestones.LinkOpened,
                OccurredAtUtc = nowUtc,
                ClientIpAddress = metadata.ClientIpAddress,
                BrowserFingerprintHash = metadata.FingerprintHash,
                UserAgent = request.UserAgent,
            });
        }

        invitation.Status = "InProgress";

        await dbContext.SaveChangesAsync(cancellationToken);

        return MapSessionDto(invitation, attempt);
    }

    public async Task<CandidateAccessSubmissionDto> SubmitAsync(
        SubmitCandidateAttemptDto request,
        CancellationToken cancellationToken)
    {
        var normalizedToken = NormalizeToken(request.Token);
        var invitation = await FindInvitationByTokenAsync(normalizedToken, includeQuestions: false, cancellationToken)
            ?? throw new ApiException("Invitation link is invalid.", StatusCodes.Status404NotFound);

        var settings = await GetEffectiveSettingsAsync(invitation.TestId, cancellationToken);

        var nowUtc = DateTime.UtcNow;
        var state = ResolveState(invitation, settings, nowUtc);

        if (state == InvitationAccessState.Expired)
        {
            throw new ApiException(
                BuildExpiredMessage(invitation, settings, nowUtc),
                StatusCodes.Status410Gone);
        }

        if (state == InvitationAccessState.Submitted)
        {
            throw new ApiException(
                "This invitation link was already used for a submitted attempt.",
                StatusCodes.Status409Conflict);
        }

        if (state == InvitationAccessState.Invited)
        {
            throw new ApiException(
                "Start the assessment before submitting.",
                StatusCodes.Status409Conflict);
        }

        if (settings.EmailVerificationEnabled && !invitation.EmailVerifiedAtUtc.HasValue)
        {
            throw new ApiException(
                "Email verification is required before submitting this assessment.",
                StatusCodes.Status403Forbidden);
        }

        var metadata = BuildAccessMetadata(
            request.ClientIpAddress,
            request.BrowserFingerprint,
            request.UserAgent);

        await ApplyAndValidateAccessLocksAsync(invitation, metadata, settings, cancellationToken);

        var attempt = GetActiveAttempt(invitation);
        if (attempt is null)
        {
            throw new ApiException(
                "Start the assessment before submitting.",
                StatusCodes.Status409Conflict);
        }

        if (attempt.StartedAtUtc == default)
        {
            attempt.StartedAtUtc = nowUtc;
        }

        attempt.AnswersJson = SerializeJsonPayload(request.Answers, "{}");
        attempt.ResultJson = SerializeJsonPayload(request.Result, "{}");
        attempt.SubmittedAtUtc = nowUtc;

        invitation.AttemptStartedAtUtc = attempt.StartedAtUtc;
        invitation.AttemptSubmittedAtUtc = nowUtc;
        invitation.Status = "Submitted";

        dbContext.CandidateProgressEvents.Add(new CandidateProgressEvent
        {
            InvitationId = invitation.Id,
            TestId = invitation.TestId,
            CandidateEmail = invitation.Email,
            CandidateName = invitation.CandidateName,
            AttemptId = attempt.Id,
            AttemptNumber = attempt.AttemptNumber,
            Milestone = CandidateProgressMilestones.Submitted,
            OccurredAtUtc = nowUtc,
            ClientIpAddress = metadata.ClientIpAddress,
            BrowserFingerprintHash = metadata.FingerprintHash,
            UserAgent = request.UserAgent,
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return new CandidateAccessSubmissionDto
        {
            InvitationId = invitation.Id.ToString(),
            AttemptId = attempt.Id.ToString(),
            TestId = invitation.TestId.ToString(),
            TestTitle = invitation.TestTitle,
            CandidateEmail = invitation.Email,
            CandidateName = invitation.CandidateName,
            Status = "Submitted",
            SubmittedAtUtc = nowUtc.ToString("O"),
            AnswersJson = attempt.AnswersJson,
            ResultJson = attempt.ResultJson,
        };
    }

    private async Task<LinkSecurityRuntimeSettings> GetEffectiveSettingsAsync(
        Guid testId,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.CandidateLinkSecuritySettings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.TestId == testId, cancellationToken);

        if (settings is null)
        {
            return new LinkSecurityRuntimeSettings(
                SingleUseLinkEnabled: true,
                EmailVerificationEnabled: true,
                IpLockEnabled: false,
                BrowserFingerprintEnabled: false,
                GracePeriodValue: CandidateLinkSecurityPolicy.DefaultGracePeriodValue,
                GracePeriodUnit: CandidateLinkSecurityPolicy.DefaultGracePeriodUnit);
        }

        return new LinkSecurityRuntimeSettings(
            settings.SingleUseLinkEnabled,
            settings.EmailVerificationEnabled,
            settings.IpLockEnabled,
            settings.BrowserFingerprintEnabled,
            settings.GracePeriodValue,
            settings.GracePeriodUnit);
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
            .FirstOrDefaultAsync(cancellationToken);

        return settings?.DefaultMaxAttempts ?? CandidateAttemptPolicy.DefaultMaxAttempts;
    }

    private static void EnforceEmailVerification(
        CandidateInvitation invitation,
        string? candidateEmail,
        LinkSecurityRuntimeSettings settings,
        DateTime nowUtc)
    {
        if (!settings.EmailVerificationEnabled)
        {
            return;
        }

        var normalizedCandidateEmail = NormalizeVerificationEmail(candidateEmail);
        if (!string.Equals(normalizedCandidateEmail, invitation.Email, StringComparison.OrdinalIgnoreCase))
        {
            throw new ApiException(
                "Email verification failed for this invitation.",
                StatusCodes.Status403Forbidden);
        }

        invitation.VerifiedEmail = invitation.Email;
        invitation.EmailVerifiedAtUtc ??= nowUtc;
    }

    private static AccessRequestMetadata BuildAccessMetadata(
        string? clientIpAddress,
        string? browserFingerprint,
        string? userAgent)
    {
        var normalizedIpAddress = NormalizeClientIpAddress(clientIpAddress);
        var fingerprintHash = NormalizeAndHashFingerprint(browserFingerprint);
        return new AccessRequestMetadata(normalizedIpAddress, fingerprintHash);
    }

    private async Task ApplyAndValidateAccessLocksAsync(
        CandidateInvitation invitation,
        AccessRequestMetadata metadata,
        LinkSecurityRuntimeSettings settings,
        CancellationToken cancellationToken)
    {
        var requiresFingerprintLock = settings.SingleUseLinkEnabled || settings.BrowserFingerprintEnabled;
        if (requiresFingerprintLock)
        {
            if (string.IsNullOrWhiteSpace(metadata.FingerprintHash))
            {
                throw new ApiException(
                    "Browser fingerprint is required for this invitation.",
                    StatusCodes.Status400BadRequest);
            }

            if (string.IsNullOrWhiteSpace(invitation.AccessFingerprintHash))
            {
                if (dbContext.Database.IsRelational())
                {
                    var updatedRows = await dbContext.CandidateInvitations
                        .Where(item =>
                            item.Id == invitation.Id &&
                            (item.AccessFingerprintHash == null || item.AccessFingerprintHash == string.Empty))
                        .ExecuteUpdateAsync(
                            updates => updates.SetProperty(item => item.AccessFingerprintHash, metadata.FingerprintHash),
                            cancellationToken);

                    if (updatedRows > 0)
                    {
                        invitation.AccessFingerprintHash = metadata.FingerprintHash;
                    }
                    else
                    {
                        invitation.AccessFingerprintHash = await dbContext.CandidateInvitations
                            .AsNoTracking()
                            .Where(item => item.Id == invitation.Id)
                            .Select(item => item.AccessFingerprintHash)
                            .FirstOrDefaultAsync(cancellationToken);
                    }
                }
                else
                {
                    invitation.AccessFingerprintHash = metadata.FingerprintHash;
                }
            }

            if (!string.Equals(invitation.AccessFingerprintHash, metadata.FingerprintHash, StringComparison.Ordinal))
            {
                throw new ApiException(
                    settings.SingleUseLinkEnabled
                        ? "This single-use invitation is already active in another browser."
                        : "Browser fingerprint validation failed for this invitation.",
                    StatusCodes.Status409Conflict);
            }
        }

        if (settings.IpLockEnabled)
        {
            if (string.IsNullOrWhiteSpace(metadata.ClientIpAddress))
            {
                throw new ApiException(
                    "Client IP address is required for this invitation.",
                    StatusCodes.Status400BadRequest);
            }

            if (string.IsNullOrWhiteSpace(invitation.LockedIpAddress))
            {
                if (dbContext.Database.IsRelational())
                {
                    var updatedRows = await dbContext.CandidateInvitations
                        .Where(item =>
                            item.Id == invitation.Id &&
                            (item.LockedIpAddress == null || item.LockedIpAddress == string.Empty))
                        .ExecuteUpdateAsync(
                            updates => updates.SetProperty(item => item.LockedIpAddress, metadata.ClientIpAddress),
                            cancellationToken);

                    if (updatedRows > 0)
                    {
                        invitation.LockedIpAddress = metadata.ClientIpAddress;
                    }
                    else
                    {
                        invitation.LockedIpAddress = await dbContext.CandidateInvitations
                            .AsNoTracking()
                            .Where(item => item.Id == invitation.Id)
                            .Select(item => item.LockedIpAddress)
                            .FirstOrDefaultAsync(cancellationToken);
                    }
                }
                else
                {
                    invitation.LockedIpAddress = metadata.ClientIpAddress;
                }
            }

            if (!string.Equals(invitation.LockedIpAddress, metadata.ClientIpAddress, StringComparison.OrdinalIgnoreCase))
            {
                throw new ApiException(
                    "IP lock validation failed for this invitation.",
                    StatusCodes.Status409Conflict);
            }
        }
    }

    private async Task<CandidateInvitation?> FindInvitationByTokenAsync(
        string token,
        bool includeQuestions,
        CancellationToken cancellationToken)
    {
        var tokenHash = HashToken(token);
        var legacyTokenHash = LegacyHashToken(token);

        IQueryable<CandidateInvitation> query = dbContext.CandidateInvitations
            .Include(item => item.Attempts);

        if (includeQuestions)
        {
            query = query
                .Include(item => item.Test!)
                .ThenInclude(test => test.TestQuestions)
                .ThenInclude(testQuestion => testQuestion.Question!)
                .ThenInclude(question => question.Options)
                .AsSplitQuery();
        }

        return await query.FirstOrDefaultAsync(
            item => item.TokenHash == tokenHash || item.TokenHash == legacyTokenHash,
            cancellationToken);
    }

    private static string NormalizeToken(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ApiException("token is required.", StatusCodes.Status400BadRequest);
        }

        var normalized = value.Trim();
        if (normalized.Length < 16 || normalized.Length > 512)
        {
            throw new ApiException("token is invalid.", StatusCodes.Status400BadRequest);
        }

        foreach (var ch in normalized)
        {
            if (!char.IsLetterOrDigit(ch) && ch != '-' && ch != '_')
            {
                throw new ApiException("token is invalid.", StatusCodes.Status400BadRequest);
            }
        }

        return normalized;
    }

    private static string NormalizeVerificationEmail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ApiException(
                "Candidate email is required to verify this invitation.",
                StatusCodes.Status400BadRequest);
        }

        var normalized = value.Trim().ToLowerInvariant();
        if (!normalized.Contains('@'))
        {
            throw new ApiException(
                "Candidate email is invalid.",
                StatusCodes.Status400BadRequest);
        }

        return normalized;
    }

    private static string? NormalizeClientIpAddress(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        if (normalized.Length <= 64)
        {
            return normalized;
        }

        return normalized[..64];
    }

    private static string? NormalizeAndHashFingerprint(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        var bytes = Encoding.UTF8.GetBytes(normalized);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    private static string HashToken(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    private static string LegacyHashToken(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);
        var hash = MD5.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    private static InvitationAccessState ResolveState(
        CandidateInvitation invitation,
        LinkSecurityRuntimeSettings settings,
        DateTime nowUtc)
    {
        if (invitation.AttemptSubmittedAtUtc.HasValue || IsStatus(invitation.Status, "Submitted"))
        {
            return InvitationAccessState.Submitted;
        }

        if (IsExpired(invitation, settings, nowUtc))
        {
            return InvitationAccessState.Expired;
        }

        if (invitation.AttemptStartedAtUtc.HasValue || IsStatus(invitation.Status, "InProgress"))
        {
            return InvitationAccessState.InProgress;
        }

        return InvitationAccessState.Invited;
    }

    private static bool IsExpired(
        CandidateInvitation invitation,
        LinkSecurityRuntimeSettings settings,
        DateTime nowUtc)
    {
        var effectiveTokenExpiryUtc = invitation.TokenExpiresAtUtc;
        var hasStartedAttempt = invitation.AttemptStartedAtUtc.HasValue ||
            IsStatus(invitation.Status, "InProgress");

        if (hasStartedAttempt)
        {
            effectiveTokenExpiryUtc = effectiveTokenExpiryUtc.Add(GetGracePeriodDuration(settings));
        }

        if (effectiveTokenExpiryUtc <= nowUtc)
        {
            return true;
        }

        return invitation.DeadlineUtc.HasValue && invitation.DeadlineUtc.Value <= nowUtc;
    }

    private static string BuildExpiredMessage(
        CandidateInvitation invitation,
        LinkSecurityRuntimeSettings settings,
        DateTime nowUtc)
    {
        if (invitation.DeadlineUtc.HasValue && invitation.DeadlineUtc.Value <= nowUtc)
        {
            return "This invitation is expired because the assessment deadline has passed.";
        }

        var hasStartedAttempt = invitation.AttemptStartedAtUtc.HasValue ||
            IsStatus(invitation.Status, "InProgress");
        if (hasStartedAttempt)
        {
            var gracePeriod = GetGracePeriodDuration(settings);
            if (invitation.TokenExpiresAtUtc.Add(gracePeriod) <= nowUtc)
            {
                return "This invitation expired because the grace period after link expiry has ended.";
            }
        }

        return "This invitation link has expired.";
    }

    private static TimeSpan GetGracePeriodDuration(LinkSecurityRuntimeSettings settings)
    {
        try
        {
            return CandidateLinkSecurityPolicy.ToGracePeriodDuration(
                settings.GracePeriodValue,
                settings.GracePeriodUnit);
        }
        catch (ArgumentException)
        {
            return TimeSpan.FromMinutes(CandidateLinkSecurityPolicy.DefaultGracePeriodValue);
        }
    }

    private static bool IsStatus(string? value, string expected)
    {
        return string.Equals(value?.Trim(), expected, StringComparison.OrdinalIgnoreCase);
    }

    private static CandidateAccessValidationDto MapValidationDto(
        CandidateInvitation invitation,
        InvitationAccessState state,
        DateTime nowUtc,
        LinkSecurityRuntimeSettings settings,
        bool attemptLimitReached)
    {
        var reusableSubmittedState =
            !settings.SingleUseLinkEnabled &&
            state == InvitationAccessState.Submitted;

        var singleUseAlreadyOpened =
            settings.SingleUseLinkEnabled &&
            state == InvitationAccessState.InProgress;

        var mappedStatus = singleUseAlreadyOpened ? "Invalid" : state.ToString();

        var mapped = new CandidateAccessValidationDto
        {
            IsValid = !singleUseAlreadyOpened &&
                (state is InvitationAccessState.Invited or InvitationAccessState.InProgress || reusableSubmittedState),
            CanStart = state == InvitationAccessState.Invited || reusableSubmittedState,
            CanResume = !singleUseAlreadyOpened && state == InvitationAccessState.InProgress,
            CanSubmit = !singleUseAlreadyOpened && state == InvitationAccessState.InProgress,
            RequiresEmailVerification = settings.EmailVerificationEnabled,
            RequiresIpLock = settings.IpLockEnabled,
            RequiresBrowserFingerprint = settings.BrowserFingerprintEnabled || settings.SingleUseLinkEnabled,
            SingleUseLinkEnabled = settings.SingleUseLinkEnabled,
            Status = mappedStatus,
            Message = singleUseAlreadyOpened
                ? "This single-use invitation link has already been opened."
                : state switch
            {
                InvitationAccessState.Invited => settings.EmailVerificationEnabled
                    ? "Invitation link is valid. Email verification is required before start."
                    : "Invitation link is valid.",
                InvitationAccessState.InProgress => "An in-progress attempt was found. You can resume.",
                InvitationAccessState.Submitted => reusableSubmittedState
                    ? "A previous attempt was submitted. You can start a new attempt with this link."
                    : "This invitation link has already been used for a submitted attempt.",
                InvitationAccessState.Expired => BuildExpiredMessage(invitation, settings, nowUtc),
                _ => "Invitation link is invalid."
            },
            InvitationId = invitation.Id.ToString(),
            TestId = invitation.TestId.ToString(),
            TestTitle = invitation.TestTitle,
            CandidateEmail = invitation.Email,
            CandidateName = invitation.CandidateName,
            DeadlineUtc = invitation.DeadlineUtc?.ToString("O"),
            TokenExpiresAtUtc = invitation.TokenExpiresAtUtc.ToString("O"),
            TimeLimitMinutes = invitation.TimeLimitMinutes,
        };

        if (attemptLimitReached)
        {
            mapped.IsValid = false;
            mapped.CanStart = false;
            mapped.CanResume = false;
            mapped.CanSubmit = false;
            mapped.Status = "Invalid";
            mapped.Message = "Maximum attempts reached.";
        }

        return mapped;
    }

    private static CandidateAccessSessionDto MapSessionDto(
        CandidateInvitation invitation,
        CandidateTestAttempt attempt)
    {
        var questions = invitation.Test?.TestQuestions
            .Select(item => item.Question)
            .Where(item => item is not null)
            .Select(MapQuestionDto)
            .ToList() ?? [];

        return new CandidateAccessSessionDto
        {
            InvitationId = invitation.Id.ToString(),
            AttemptId = attempt.Id.ToString(),
            TestId = invitation.TestId.ToString(),
            TestTitle = invitation.TestTitle,
            CandidateEmail = invitation.Email,
            CandidateName = invitation.CandidateName,
            Status = invitation.Status,
            DeadlineUtc = invitation.DeadlineUtc?.ToString("O"),
            TokenExpiresAtUtc = invitation.TokenExpiresAtUtc.ToString("O"),
            TimeLimitMinutes = invitation.TimeLimitMinutes,
            StartedAtUtc = attempt.StartedAtUtc.ToString("O"),
            SubmittedAtUtc = attempt.SubmittedAtUtc?.ToString("O"),
            AnswersJson = attempt.AnswersJson,
            ResultJson = attempt.ResultJson,
            Questions = questions,
        };
    }

    private static CandidateAccessQuestionDto MapQuestionDto(Question question)
    {
        return new CandidateAccessQuestionDto
        {
            Id = question.Id.ToString(),
            Title = question.Title,
            Description = question.Description,
            Type = question.Type.ToString(),
            Points = question.Points,
            DurationMinutes = question.DurationMinutes,
            Language = question.Language,
            StarterCode = question.StarterCode,
            EvaluationCriteria = question.EvaluationCriteria,
            Options = question.Options
                .Select(option => new CandidateAccessQuestionOptionDto
                {
                    Id = option.Id.ToString(),
                    Text = option.Text,
                })
                .ToList()
        };
    }

    private static string SerializeJsonPayload(JsonElement? payload, string fallback)
    {
        if (!payload.HasValue ||
            payload.Value.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return fallback;
        }

        return payload.Value.GetRawText();
    }

    private static CandidateTestAttempt? GetActiveAttempt(CandidateInvitation invitation)
    {
        return invitation.Attempts
            .Where(item => !item.SubmittedAtUtc.HasValue)
            .OrderByDescending(item => item.AttemptNumber)
            .ThenByDescending(item => item.CreatedAt)
            .FirstOrDefault();
    }

    private static int GetNextAttemptNumber(CandidateInvitation invitation)
    {
        return invitation.Attempts.Count == 0
            ? 1
            : invitation.Attempts.Max(item => item.AttemptNumber) + 1;
    }

    private enum InvitationAccessState
    {
        Invited,
        InProgress,
        Submitted,
        Expired,
    }

    private sealed record LinkSecurityRuntimeSettings(
        bool SingleUseLinkEnabled,
        bool EmailVerificationEnabled,
        bool IpLockEnabled,
        bool BrowserFingerprintEnabled,
        int GracePeriodValue,
        string GracePeriodUnit);

    private sealed record AccessRequestMetadata(string? ClientIpAddress, string? FingerprintHash);
}

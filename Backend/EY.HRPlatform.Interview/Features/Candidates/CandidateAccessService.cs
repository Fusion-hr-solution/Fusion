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

        // Count link opens when the invite page is loaded (validate endpoint).
        if (state is InvitationAccessState.Invited or InvitationAccessState.InProgress)
        {
            invitation.OpensCount += 1;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return MapValidationDto(invitation, state, nowUtc, settings);
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
            throw new ApiException(
                "This invitation link was already used for a submitted attempt.",
                StatusCodes.Status409Conflict);
        }

        if (settings.SingleUseLinkEnabled && state == InvitationAccessState.InProgress)
        {
            throw new ApiException(
                "This single-use invitation link has already been opened.",
                StatusCodes.Status409Conflict);
        }

        EnforceEmailVerification(invitation, request.CandidateEmail, settings, nowUtc);

        var metadata = BuildAccessMetadata(
            request.ClientIpAddress,
            request.BrowserFingerprint,
            request.UserAgent);

        ApplyAndValidateAccessLocks(invitation, metadata, settings);

        var attempt = invitation.Attempt;
        if (attempt is null)
        {
            attempt = new CandidateTestAttempt
            {
                InvitationId = invitation.Id,
                TestId = invitation.TestId,
                CandidateEmail = invitation.Email,
                CandidateName = invitation.CandidateName,
                StartedAtUtc = nowUtc,
                SubmittedAtUtc = null,
                AnswersJson = "{}",
                ResultJson = "{}"
            };

            dbContext.CandidateTestAttempts.Add(attempt);
            invitation.Attempt = attempt;
        }

        if (attempt.StartedAtUtc == default)
        {
            attempt.StartedAtUtc = nowUtc;
        }

        invitation.AttemptStartedAtUtc ??= attempt.StartedAtUtc;

        // Keep first direct start counted if a client bypasses validate.
        if (state == InvitationAccessState.Invited && invitation.OpensCount == 0)
        {
            invitation.OpensCount = 1;
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

        if (state == InvitationAccessState.Invited || invitation.Attempt is null)
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

        ApplyAndValidateAccessLocks(invitation, metadata, settings);

        var attempt = invitation.Attempt;
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

        invitation.AttemptStartedAtUtc ??= attempt.StartedAtUtc;
        invitation.AttemptSubmittedAtUtc = nowUtc;
        invitation.Status = "Submitted";

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
        var fingerprintSource = !string.IsNullOrWhiteSpace(browserFingerprint)
            ? browserFingerprint
            : userAgent;

        var fingerprintHash = NormalizeAndHashFingerprint(fingerprintSource);

        return new AccessRequestMetadata(normalizedIpAddress, fingerprintHash);
    }

    private static void ApplyAndValidateAccessLocks(
        CandidateInvitation invitation,
        AccessRequestMetadata metadata,
        LinkSecurityRuntimeSettings settings)
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
                invitation.AccessFingerprintHash = metadata.FingerprintHash;
            }
            else if (!string.Equals(invitation.AccessFingerprintHash, metadata.FingerprintHash, StringComparison.Ordinal))
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
                invitation.LockedIpAddress = metadata.ClientIpAddress;
            }
            else if (!string.Equals(invitation.LockedIpAddress, metadata.ClientIpAddress, StringComparison.OrdinalIgnoreCase))
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
            .Include(item => item.Attempt);

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
        if (invitation.AttemptSubmittedAtUtc.HasValue ||
            invitation.Attempt?.SubmittedAtUtc.HasValue == true ||
            IsStatus(invitation.Status, "Submitted"))
        {
            return InvitationAccessState.Submitted;
        }

        if (IsExpired(invitation, settings, nowUtc))
        {
            return InvitationAccessState.Expired;
        }

        if (invitation.AttemptStartedAtUtc.HasValue ||
            invitation.Attempt is not null ||
            IsStatus(invitation.Status, "InProgress"))
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
            invitation.Attempt is not null ||
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
            invitation.Attempt is not null ||
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
        LinkSecurityRuntimeSettings settings)
    {
        var singleUseAlreadyOpened =
            settings.SingleUseLinkEnabled &&
            state == InvitationAccessState.InProgress;

        var mappedStatus = singleUseAlreadyOpened ? "Invalid" : state.ToString();

        return new CandidateAccessValidationDto
        {
            IsValid = !singleUseAlreadyOpened && state is InvitationAccessState.Invited or InvitationAccessState.InProgress,
            CanStart = state == InvitationAccessState.Invited,
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
                InvitationAccessState.Submitted => "This invitation link has already been used for a submitted attempt.",
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

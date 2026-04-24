using System.Globalization;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Candidates;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.Candidates;

public class CandidateInvitationService(
    AppDbContext dbContext,
    IConfiguration configuration,
    ICandidateInvitationEmailSender emailSender,
    ILogger<CandidateInvitationService> logger)
    : ICandidateInvitationService
{
    private const int DefaultLinkExpiryHours = 72;
    private const int MaxLinkExpiryHours = 720;

    public async Task<CandidateInvitationDto> CreateAsync(CreateCandidateInvitationDto request, CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(request.Email);
        var test = await ResolveTestAsync(request.TestId, cancellationToken);
        var deadlineUtc = ParseDeadline(request.DeadlineUtc);
        var inviteMethod = NormalizeInviteMethod(request.InviteMethod);
        var linkExpiryHours = await ResolveLinkExpiryHoursAsync(test.Id, request.LinkExpiryHours, cancellationToken);
        var timeLimitMinutes = NormalizeTimeLimitMinutes(request.TimeLimitMinutes);
        var customMessage = NormalizeCustomMessage(request.CustomMessage);

        var invitation = await BuildInvitationAsync(
            test,
            normalizedEmail,
            request.CandidateName,
            deadlineUtc,
            inviteMethod,
            linkExpiryHours,
            timeLimitMinutes,
            customMessage,
            request.SendNotification,
            cancellationToken);

        dbContext.CandidateInvitations.Add(invitation);
        dbContext.CandidateProgressEvents.Add(BuildInvitedEvent(invitation, attemptNumber: 1, DateTime.UtcNow));
        await dbContext.SaveChangesAsync(cancellationToken);

        LogCandidateInvited(invitation);

        return MapToDto(invitation);
    }

    public async Task<IReadOnlyList<CandidateInvitationDto>> CreateBulkAsync(
        CreateBulkCandidateInvitationsDto request,
        CancellationToken cancellationToken)
    {
        var candidateNamesByEmail = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var candidate in request.Candidates)
        {
            if (string.IsNullOrWhiteSpace(candidate.Email))
            {
                continue;
            }

            var normalizedCandidateEmail = NormalizeEmail(candidate.Email);
            var normalizedCandidateName = NormalizeCandidateName(candidate.CandidateName);
            if (!candidateNamesByEmail.TryGetValue(normalizedCandidateEmail, out var existingName) ||
                (string.IsNullOrWhiteSpace(existingName) && !string.IsNullOrWhiteSpace(normalizedCandidateName)))
            {
                candidateNamesByEmail[normalizedCandidateEmail] = normalizedCandidateName;
            }
        }

        var uniqueEmails = request.Emails
            .Where(email => !string.IsNullOrWhiteSpace(email))
            .Select(NormalizeEmail)
            .Concat(candidateNamesByEmail.Keys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (uniqueEmails.Count == 0)
        {
            throw new ApiException("At least one valid email is required.", StatusCodes.Status400BadRequest);
        }

        var test = await ResolveTestAsync(request.TestId, cancellationToken);
        var deadlineUtc = ParseDeadline(request.DeadlineUtc);
        var inviteMethod = NormalizeInviteMethod(request.InviteMethod);
        var linkExpiryHours = await ResolveLinkExpiryHoursAsync(test.Id, request.LinkExpiryHours, cancellationToken);
        var timeLimitMinutes = NormalizeTimeLimitMinutes(request.TimeLimitMinutes);
        var customMessage = NormalizeCustomMessage(request.CustomMessage);
        var defaultCandidateName = NormalizeCandidateName(request.CandidateName);

        var invitations = new List<CandidateInvitation>(uniqueEmails.Count);
        foreach (var email in uniqueEmails)
        {
            candidateNamesByEmail.TryGetValue(email, out var candidateNameForEmail);
            var resolvedCandidateName = candidateNameForEmail ?? defaultCandidateName;

            var invitation = await BuildInvitationAsync(
                test,
                email,
                resolvedCandidateName,
                deadlineUtc,
                inviteMethod,
                linkExpiryHours,
                timeLimitMinutes,
                customMessage,
                request.SendNotification,
                cancellationToken);

            invitations.Add(invitation);
        }

        dbContext.CandidateInvitations.AddRange(invitations);
        var invitedAtUtc = DateTime.UtcNow;
        foreach (var invitation in invitations)
        {
            dbContext.CandidateProgressEvents.Add(BuildInvitedEvent(invitation, attemptNumber: 1, invitedAtUtc));
        }
        await dbContext.SaveChangesAsync(cancellationToken);

        foreach (var invitation in invitations)
        {
            LogCandidateInvited(invitation);
        }

        return invitations.Select(MapToDto).ToList();
    }

    private async Task<CandidateInvitation> BuildInvitationAsync(
        Test test,
        string normalizedEmail,
        string? candidateName,
        DateTime? deadlineUtc,
        string inviteMethod,
        int linkExpiryHours,
        int? timeLimitMinutes,
        string? customMessage,
        bool sendNotification,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var token = GenerateToken();

        var invitation = new CandidateInvitation
        {
            TestId = test.Id,
            TestTitle = test.Title,
            Email = normalizedEmail,
            CandidateName = string.IsNullOrWhiteSpace(candidateName) ? null : candidateName.Trim(),
            Status = "Invited",
            DeadlineUtc = deadlineUtc,
            InviteMethod = inviteMethod,
            LinkExpiryHours = linkExpiryHours,
            TimeLimitMinutes = timeLimitMinutes,
            CustomMessage = customMessage,
            InviteLink = BuildInviteLink(token),
            TokenHash = HashToken(token),
            TokenCreatedAtUtc = now,
            TokenExpiresAtUtc = now.AddHours(linkExpiryHours),
            LastSentAtUtc = now,
            ResendCount = 0,
            OpensCount = 0,
            AttemptStartedAtUtc = null,
            AttemptSubmittedAtUtc = null,
        };

        if (sendNotification)
        {
            try
            {
                await emailSender.SendInvitationAsync(MapToDto(invitation), cancellationToken);
                invitation.Status = "Invited";
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
                invitation.Status = "DeliveryFailed";
                logger.LogWarning(
                    ex,
                    "Candidate invitation delivery failed. InvitationId={InvitationId} | Email={Email}",
                    invitation.Id.ToString(),
                    invitation.Email);
            }
        }

        return invitation;
    }

    private void LogCandidateInvited(CandidateInvitation invitation)
    {
        logger.LogInformation(
            "Audit Event: CandidateInvited | TestId={TestId} | Email={Email} | InvitationId={InvitationId} | Status={Status}",
            invitation.TestId.ToString(),
            invitation.Email,
            invitation.Id.ToString(),
            invitation.Status
        );
    }

    public Task<IReadOnlyList<CandidateInvitationDto>> GetPendingAsync(string? testId, CancellationToken cancellationToken)
    {
        return GetPendingInternalAsync(testId, cancellationToken);
    }

    public async Task<CandidateInvitationDto> ResendAsync(string invitationId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!Guid.TryParse(invitationId, out var parsedId))
        {
            throw new ApiException("Valid invitation id is required.", StatusCodes.Status400BadRequest);
        }

        var invitation = await dbContext.CandidateInvitations
            .FirstOrDefaultAsync(item => item.Id == parsedId, cancellationToken);

        if (invitation is null)
        {
            throw new ApiException("Invitation not found.", StatusCodes.Status404NotFound);
        }

        if (IsStatus(invitation.Status, "Submitted"))
        {
            throw new ApiException(
                "Cannot resend invitation after a submitted attempt.",
                StatusCodes.Status409Conflict);
        }

        var now = DateTime.UtcNow;
        var token = GenerateToken();

        invitation.LastSentAtUtc = now;
        invitation.ResendCount += 1;
        invitation.InviteLink = BuildInviteLink(token);
        invitation.TokenHash = HashToken(token);
        invitation.TokenCreatedAtUtc = now;
        invitation.TokenExpiresAtUtc = now.AddHours(invitation.LinkExpiryHours);
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

        try
        {
            await emailSender.SendInvitationAsync(MapToDto(invitation), cancellationToken);
            invitation.Status = "Invited";
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
            invitation.Status = "DeliveryFailed";
            logger.LogWarning(
                ex,
                "Candidate invitation resend failed. InvitationId={InvitationId} | Email={Email}",
                    invitation.Id.ToString(),
                invitation.Email);
        }

            dbContext.CandidateProgressEvents.Add(BuildInvitedEvent(invitation, nextAttemptNumber, now));

        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Audit Event: CandidateInvitationResent | InvitationId={InvitationId} | Email={Email} | ResendCount={ResendCount} | Status={Status}",
            invitation.Id.ToString(),
            invitation.Email,
            invitation.ResendCount,
            invitation.Status
        );

        return MapToDto(invitation);
    }

    private async Task<IReadOnlyList<CandidateInvitationDto>> GetPendingInternalAsync(
        string? testId,
        CancellationToken cancellationToken)
    {
        var query = dbContext.CandidateInvitations.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(testId))
        {
            if (!Guid.TryParse(testId, out var parsedTestId))
            {
                return [];
            }

            query = query.Where(item => item.TestId == parsedTestId);
        }

        var data = await query
            .Where(item => item.Status == "Invited" || item.Status == "DeliveryFailed")
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);

        return data.Select(MapToDto).ToList();
    }

    private async Task<Domain.Entities.Test> ResolveTestAsync(string testId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(testId, out var parsedId))
        {
            throw new ApiException("Valid testId is required.", StatusCodes.Status400BadRequest);
        }

        var test = await dbContext.Tests.AsNoTracking().FirstOrDefaultAsync(t => t.Id == parsedId, cancellationToken);
        if (test is null)
        {
            throw new ApiException("Test not found.", StatusCodes.Status404NotFound);
        }

        return test;
    }

    private static string NormalizeEmail(string value)
    {
        var trimmed = value.Trim();
        if (string.IsNullOrWhiteSpace(trimmed) || !trimmed.Contains('@'))
        {
            throw new ApiException("Valid email is required.", StatusCodes.Status400BadRequest);
        }

        return trimmed.ToLowerInvariant();
    }

    private static string? NormalizeCandidateName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private static DateTime? ParseDeadline(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (!DateTimeOffset.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var parsed))
        {
            throw new ApiException(
                "deadlineUtc must be a valid ISO-8601 date/time.",
                StatusCodes.Status400BadRequest);
        }

        return parsed.UtcDateTime;
    }

    private static string NormalizeInviteMethod(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "email";
        }

        var normalized = value.Trim().ToLowerInvariant();
        return normalized switch
        {
            "email" or "bulk" or "link" => normalized,
            _ => throw new ApiException(
                "inviteMethod must be one of: email, bulk, link.",
                StatusCodes.Status400BadRequest),
        };
    }

    private static int? NormalizeTimeLimitMinutes(int? value)
    {
        if (!value.HasValue)
        {
            return null;
        }

        if (value.Value <= 0)
        {
            throw new ApiException(
                "timeLimitMinutes must be greater than 0 when provided.",
                StatusCodes.Status400BadRequest);
        }

        return value;
    }

    private static string? NormalizeCustomMessage(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (trimmed.Length > 2000)
        {
            throw new ApiException(
                "customMessage must be 2000 characters or fewer.",
                StatusCodes.Status400BadRequest);
        }

        return trimmed;
    }

    private async Task<int> ResolveLinkExpiryHoursAsync(
        Guid testId,
        int? requestValue,
        CancellationToken cancellationToken)
    {
        if (requestValue.HasValue)
        {
            return NormalizeLinkExpiryHours(requestValue);
        }

        var settings = await dbContext.CandidateLinkSecuritySettings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.TestId == testId, cancellationToken);

        if (settings is null)
        {
            return NormalizeLinkExpiryHours(null);
        }

        try
        {
            var linkValidity = CandidateLinkSecurityPolicy.ToLinkValidityDuration(
                settings.LinkValidForValue,
                settings.LinkValidForUnit);

            var roundedHours = CandidateLinkSecurityPolicy.ToRoundedHours(linkValidity);
            return NormalizeLinkExpiryHours(roundedHours);
        }
        catch (ArgumentException)
        {
            return NormalizeLinkExpiryHours(null);
        }
    }

    private int NormalizeLinkExpiryHours(int? value)
    {
        if (value.HasValue)
        {
            if (value.Value <= 0 || value.Value > MaxLinkExpiryHours)
            {
                throw new ApiException(
                    $"linkExpiryHours must be between 1 and {MaxLinkExpiryHours}.",
                    StatusCodes.Status400BadRequest);
            }

            return value.Value;
        }

        var configuredDefault = configuration.GetValue<int?>("CandidateInvitations:DefaultLinkExpiryHours");
        if (configuredDefault.HasValue &&
            configuredDefault.Value > 0 &&
            configuredDefault.Value <= MaxLinkExpiryHours)
        {
            return configuredDefault.Value;
        }

        return DefaultLinkExpiryHours;
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

    private static bool IsStatus(string? value, string expected)
    {
        return string.Equals(value?.Trim(), expected, StringComparison.OrdinalIgnoreCase);
    }

    private static CandidateInvitationDto MapToDto(CandidateInvitation invitation)
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

    private static CandidateProgressEvent BuildInvitedEvent(
        CandidateInvitation invitation,
        int attemptNumber,
        DateTime occurredAtUtc)
    {
        return new CandidateProgressEvent
        {
            InvitationId = invitation.Id,
            TestId = invitation.TestId,
            CandidateEmail = invitation.Email,
            CandidateName = invitation.CandidateName,
            AttemptNumber = attemptNumber,
            Milestone = CandidateProgressMilestones.Invited,
            OccurredAtUtc = occurredAtUtc,
        };
    }
}

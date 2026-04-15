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

        var nowUtc = DateTime.UtcNow;
        var state = ResolveState(invitation, nowUtc);

        // Count link opens when the invite page is loaded (validate endpoint).
        if (state is InvitationAccessState.Invited or InvitationAccessState.InProgress)
        {
            invitation.OpensCount += 1;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return MapValidationDto(invitation, state, nowUtc);
    }

    public async Task<CandidateAccessSessionDto> StartOrResumeAsync(string token, CancellationToken cancellationToken)
    {
        var normalizedToken = NormalizeToken(token);
        var invitation = await FindInvitationByTokenAsync(normalizedToken, includeQuestions: true, cancellationToken)
            ?? throw new ApiException("Invitation link is invalid.", StatusCodes.Status404NotFound);

        var nowUtc = DateTime.UtcNow;
        var state = ResolveState(invitation, nowUtc);

        if (state == InvitationAccessState.Expired)
        {
            throw new ApiException(
                BuildExpiredMessage(invitation, nowUtc),
                StatusCodes.Status410Gone);
        }

        if (state == InvitationAccessState.Submitted)
        {
            throw new ApiException(
                "This invitation link was already used for a submitted attempt.",
                StatusCodes.Status409Conflict);
        }

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

        var nowUtc = DateTime.UtcNow;
        var state = ResolveState(invitation, nowUtc);

        if (state == InvitationAccessState.Expired)
        {
            throw new ApiException(
                BuildExpiredMessage(invitation, nowUtc),
                StatusCodes.Status410Gone);
        }

        if (state == InvitationAccessState.Submitted)
        {
            throw new ApiException(
                "This invitation link was already used for a submitted attempt.",
                StatusCodes.Status409Conflict);
        }

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

    private static InvitationAccessState ResolveState(CandidateInvitation invitation, DateTime nowUtc)
    {
        if (invitation.AttemptSubmittedAtUtc.HasValue ||
            invitation.Attempt?.SubmittedAtUtc.HasValue == true ||
            IsStatus(invitation.Status, "Submitted"))
        {
            return InvitationAccessState.Submitted;
        }

        if (IsExpired(invitation, nowUtc))
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

    private static bool IsExpired(CandidateInvitation invitation, DateTime nowUtc)
    {
        if (invitation.TokenExpiresAtUtc <= nowUtc)
        {
            return true;
        }

        return invitation.DeadlineUtc.HasValue && invitation.DeadlineUtc.Value <= nowUtc;
    }

    private static string BuildExpiredMessage(CandidateInvitation invitation, DateTime nowUtc)
    {
        if (invitation.DeadlineUtc.HasValue && invitation.DeadlineUtc.Value <= nowUtc)
        {
            return "This invitation is expired because the assessment deadline has passed.";
        }

        return "This invitation link has expired.";
    }

    private static bool IsStatus(string? value, string expected)
    {
        return string.Equals(value?.Trim(), expected, StringComparison.OrdinalIgnoreCase);
    }

    private static CandidateAccessValidationDto MapValidationDto(
        CandidateInvitation invitation,
        InvitationAccessState state,
        DateTime nowUtc)
    {
        return new CandidateAccessValidationDto
        {
            IsValid = state is InvitationAccessState.Invited or InvitationAccessState.InProgress,
            CanStart = state == InvitationAccessState.Invited,
            CanResume = state == InvitationAccessState.InProgress,
            CanSubmit = state == InvitationAccessState.InProgress,
            Status = state.ToString(),
            Message = state switch
            {
                InvitationAccessState.Invited => "Invitation link is valid.",
                InvitationAccessState.InProgress => "An in-progress attempt was found. You can resume.",
                InvitationAccessState.Submitted => "This invitation link has already been used for a submitted attempt.",
                InvitationAccessState.Expired => BuildExpiredMessage(invitation, nowUtc),
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
}

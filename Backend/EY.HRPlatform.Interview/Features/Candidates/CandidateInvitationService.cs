using System.Collections.Concurrent;
using System.Security.Cryptography;
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
    private static readonly ConcurrentDictionary<Guid, CandidateInvitationDto> Invitations = new();

    public async Task<CandidateInvitationDto> CreateAsync(CreateCandidateInvitationDto request, CancellationToken cancellationToken)
    {
        var normalizedEmail = NormalizeEmail(request.Email);
        var test = await ResolveTestAsync(request.TestId, cancellationToken);
        var deadlineUtc = ParseDeadline(request.DeadlineUtc);

        var invitation = new CandidateInvitationDto
        {
            Id = Guid.NewGuid().ToString(),
            TestId = test.Id.ToString(),
            TestTitle = test.Title,
            Email = normalizedEmail,
            CandidateName = string.IsNullOrWhiteSpace(request.CandidateName) ? null : request.CandidateName.Trim(),
            Status = "Invited",
            DeadlineUtc = deadlineUtc?.ToString("O"),
            InviteLink = BuildInviteLink(),
            CreatedAtUtc = DateTime.UtcNow.ToString("O"),
            LastSentAtUtc = DateTime.UtcNow.ToString("O"),
            ResendCount = 0,
            OpensCount = 0,
        };

        if (request.SendNotification)
        {
            try
            {
                await emailSender.SendInvitationAsync(invitation, cancellationToken);
                invitation.Status = "Invited";
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                invitation.Status = "DeliveryFailed";
                logger.LogWarning(
                    ex,
                    "Candidate invitation delivery failed. InvitationId={InvitationId} | Email={Email}",
                    invitation.Id,
                    invitation.Email);
            }
        }

        Invitations[Guid.Parse(invitation.Id)] = invitation;

        logger.LogInformation(
            "Audit Event: CandidateInvited | TestId={TestId} | Email={Email} | InvitationId={InvitationId} | Status={Status}",
            invitation.TestId,
            invitation.Email,
            invitation.Id,
            invitation.Status
        );

        return invitation;
    }

    public async Task<IReadOnlyList<CandidateInvitationDto>> CreateBulkAsync(
        CreateBulkCandidateInvitationsDto request,
        CancellationToken cancellationToken)
    {
        var uniqueEmails = request.Emails
            .Where(email => !string.IsNullOrWhiteSpace(email))
            .Select(NormalizeEmail)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (uniqueEmails.Count == 0)
        {
            throw new ApiException("At least one valid email is required.", StatusCodes.Status400BadRequest);
        }

        var results = new List<CandidateInvitationDto>(uniqueEmails.Count);
        foreach (var email in uniqueEmails)
        {
            var created = await CreateAsync(
                new CreateCandidateInvitationDto
                {
                    TestId = request.TestId,
                    Email = email,
                    CandidateName = request.CandidateName,
                    DeadlineUtc = request.DeadlineUtc,
                    SendNotification = request.SendNotification,
                },
                cancellationToken
            );
            results.Add(created);
        }

        return results;
    }

    public Task<IReadOnlyList<CandidateInvitationDto>> GetPendingAsync(string? testId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var query = Invitations.Values.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(testId))
        {
            query = query.Where(item => item.TestId.Equals(testId, StringComparison.OrdinalIgnoreCase));
        }

        var data = query
            .Where(item =>
                item.Status.Equals("Invited", StringComparison.OrdinalIgnoreCase)
                || item.Status.Equals("DeliveryFailed", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(item => item.CreatedAtUtc)
            .ToList();

        return Task.FromResult<IReadOnlyList<CandidateInvitationDto>>(data);
    }

    public async Task<CandidateInvitationDto> ResendAsync(string invitationId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!Guid.TryParse(invitationId, out var parsedId))
        {
            throw new ApiException("Valid invitation id is required.", StatusCodes.Status400BadRequest);
        }

        if (!Invitations.TryGetValue(parsedId, out var invitation))
        {
            throw new ApiException("Invitation not found.", StatusCodes.Status404NotFound);
        }

        invitation.LastSentAtUtc = DateTime.UtcNow.ToString("O");
        invitation.ResendCount += 1;

        try
        {
            await emailSender.SendInvitationAsync(invitation, cancellationToken);
            invitation.Status = "Invited";
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            invitation.Status = "DeliveryFailed";
            logger.LogWarning(
                ex,
                "Candidate invitation resend failed. InvitationId={InvitationId} | Email={Email}",
                invitation.Id,
                invitation.Email);
        }

        Invitations[parsedId] = invitation;

        logger.LogInformation(
            "Audit Event: CandidateInvitationResent | InvitationId={InvitationId} | Email={Email} | ResendCount={ResendCount} | Status={Status}",
            invitation.Id,
            invitation.Email,
            invitation.ResendCount,
            invitation.Status
        );

        return invitation;
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

    private static DateTime? ParseDeadline(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (!DateTime.TryParse(value, out var parsed))
        {
            throw new ApiException("deadlineUtc must be a valid date.", StatusCodes.Status400BadRequest);
        }

        return DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
    }

    private string BuildInviteLink()
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

        var baseUrl = configuration["CandidateInvitations:PublicBaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            baseUrl = "http://localhost:3000/interview/candidate/start";
        }

        return $"{baseUrl}?token={token}";
    }
}

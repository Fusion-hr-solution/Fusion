using System.Security.Cryptography;
using System.Text;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Candidates;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.Candidates;

public class CandidatePrivacyActionExecutor(
    AppDbContext dbContext,
    IConfiguration configuration,
    ILogger<CandidatePrivacyActionExecutor> logger)
    : ICandidatePrivacyActionExecutor
{
    private const string PrivacyHashSecretConfigKey = "CandidatePrivacy:HashSecret";
    private const string PrivacyAliasDomainConfigKey = "CandidatePrivacy:AliasDomain";
    private const string DefaultPrivacyAliasDomain = "anonymized.invalid";
    private const string DefaultPrivacyHashSecret = "development-privacy-secret";

    public async Task<CandidatePrivacyActionResultDto> PseudonymizeAsync(
        Guid testId,
        string normalizedEmail,
        string actionType,
        string adminId,
        string triggerSource,
        IReadOnlyList<CandidateInvitation> invitations,
        CancellationToken cancellationToken)
    {
        var (emailHash, aliasEmail, aliasName) = BuildCandidateAlias(testId, normalizedEmail);
        var invitationIds = invitations.Select(item => item.Id).ToList();

        foreach (var invitation in invitations)
        {
            invitation.Email = aliasEmail;
            invitation.CandidateName = aliasName;
            invitation.VerifiedEmail = null;
            invitation.EmailVerifiedAtUtc = null;
            invitation.LockedIpAddress = null;
            invitation.AccessFingerprintHash = null;
            invitation.InviteLink = string.Empty;
            invitation.TokenHash = string.Empty;
        }

        var attempts = await dbContext.CandidateTestAttempts
            .Where(item => invitationIds.Contains(item.InvitationId))
            .ToListAsync(cancellationToken);

        foreach (var attempt in attempts)
        {
            attempt.CandidateEmail = aliasEmail;
            attempt.CandidateName = aliasName;
        }

        var events = await dbContext.CandidateProgressEvents
            .Where(item => invitationIds.Contains(item.InvitationId))
            .ToListAsync(cancellationToken);

        foreach (var progressEvent in events)
        {
            progressEvent.CandidateEmail = aliasEmail;
            progressEvent.CandidateName = aliasName;
            progressEvent.ClientIpAddress = null;
            progressEvent.BrowserFingerprintHash = null;
            progressEvent.UserAgent = null;
        }

        var logEntry = new CandidatePrivacyAction
        {
            TestId = testId,
            InvitationId = invitationIds[0],
            ActionType = actionType,
            TriggerSource = triggerSource,
            AdminId = adminId,
            CandidateEmailHash = emailHash,
            CandidateAliasEmail = aliasEmail,
            CandidateAliasName = aliasName,
            InvitationsUpdated = invitations.Count,
            AttemptsUpdated = attempts.Count,
            EventsUpdated = events.Count,
        };

        dbContext.CandidatePrivacyActions.Add(logEntry);
        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Audit Event: CandidatePrivacyAction | Action={Action} | TestId={TestId} | InvitationIds={InvitationIds} | AdminId={AdminId} | EmailHash={EmailHash} | InvitationsUpdated={InvitationsUpdated} | AttemptsUpdated={AttemptsUpdated} | EventsUpdated={EventsUpdated}",
            actionType,
            testId.ToString(),
            string.Join(',', invitationIds),
            adminId,
            emailHash,
            invitations.Count,
            attempts.Count,
            events.Count);

        return new CandidatePrivacyActionResultDto
        {
            Action = actionType,
            TestId = testId.ToString(),
            AdminId = adminId,
            TriggerSource = triggerSource,
            CandidateAliasEmail = aliasEmail,
            CandidateAliasName = aliasName,
            CandidateEmailHash = emailHash,
            InvitationIds = invitationIds.Select(item => item.ToString()).ToList(),
            InvitationsUpdated = invitations.Count,
            AttemptsUpdated = attempts.Count,
            EventsUpdated = events.Count,
            LoggedAtUtc = logEntry.CreatedAt.ToString("O"),
        };
    }

    public (string EmailHash, string AliasEmail, string AliasName) BuildCandidateAlias(
        Guid testId,
        string normalizedEmail)
    {
        var secret = ResolvePrivacyHashSecret();
        var aliasDomain = ResolvePrivacyAliasDomain();
        var input = $"{testId:N}:{normalizedEmail}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(input));
        var hashHex = Convert.ToHexString(hashBytes).ToLowerInvariant();
        var aliasSuffix = hashHex[..12];
        var aliasEmail = $"candidate+{aliasSuffix}@{aliasDomain}".ToLowerInvariant();
        var aliasNumber = (int)(BitConverter.ToUInt32(hashBytes, 0) % 90000) + 10000;
        var aliasName = $"Candidate #{aliasNumber}";

        return (hashHex, aliasEmail, aliasName);
    }

    private string ResolvePrivacyHashSecret()
    {
        var secret = configuration.GetValue<string>(PrivacyHashSecretConfigKey);
        if (!string.IsNullOrWhiteSpace(secret))
        {
            return secret;
        }

        logger.LogWarning("Candidate privacy hash secret is not configured. Using a development fallback.");
        return DefaultPrivacyHashSecret;
    }

    private string ResolvePrivacyAliasDomain()
    {
        var aliasDomain = configuration.GetValue<string>(PrivacyAliasDomainConfigKey);
        return string.IsNullOrWhiteSpace(aliasDomain)
            ? DefaultPrivacyAliasDomain
            : aliasDomain.Trim().ToLowerInvariant();
    }
}

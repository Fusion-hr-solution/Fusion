using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Candidates;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Candidates;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Interview.Tests.Features.Candidates;

public class CandidateAccessServiceTests
{
    private const string DefaultFingerprint = "fp-browser-default";

    [Fact]
    public async Task StartOrResumeAsync_WithValidToken_CreatesAttemptAndBindsCandidate()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = new CandidateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "candidate.one@example.com",
                CandidateName = "Candidate One",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);
        var session = await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.one@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None);

        Assert.Equal(created.Id, session.InvitationId);
        Assert.Equal(created.TestId, session.TestId);
        Assert.Equal("candidate.one@example.com", session.CandidateEmail);
        Assert.Equal("Candidate One", session.CandidateName);

        var invitation = await db.CandidateInvitations.FindAsync(Guid.Parse(created.Id));
        Assert.NotNull(invitation);
        Assert.Equal("InProgress", invitation!.Status);
        Assert.NotNull(invitation.AttemptStartedAtUtc);
        Assert.NotNull(invitation.EmailVerifiedAtUtc);
        Assert.NotNull(invitation.AccessFingerprintHash);
        Assert.Equal(1, invitation.OpensCount);

        var attempt = await db.CandidateTestAttempts.FirstOrDefaultAsync(item => item.InvitationId == invitation.Id);
        Assert.NotNull(attempt);
        Assert.Equal("candidate.one@example.com", attempt!.CandidateEmail);
    }

    [Fact]
    public async Task StartOrResumeAsync_WhenTokenExpired_ThrowsGone()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = new CandidateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "candidate.two@example.com",
                CandidateName = "Candidate Two",
                SendNotification = false,
            },
            CancellationToken.None);

        var invitation = await db.CandidateInvitations.FindAsync(Guid.Parse(created.Id));
        Assert.NotNull(invitation);
        invitation!.TokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();

        var token = ExtractToken(created.InviteLink);
        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.two@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None));

        Assert.Equal(410, ex.StatusCode);
    }

    [Fact]
    public async Task SubmitAsync_WhenAlreadySubmitted_ThrowsConflict()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = new CandidateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "candidate.three@example.com",
                CandidateName = "Candidate Three",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);
        await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.three@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None);

        var answers = JsonDocument.Parse("{\"responses\":[{\"questionId\":\"q1\",\"answerText\":\"answer\"}]}").RootElement.Clone();
        var result = JsonDocument.Parse("{\"score\":85}").RootElement.Clone();

        await accessService.SubmitAsync(
            new SubmitCandidateAttemptDto
            {
                Token = token,
                BrowserFingerprint = DefaultFingerprint,
                Answers = answers,
                Result = result,
            },
            CancellationToken.None);

        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.SubmitAsync(
            new SubmitCandidateAttemptDto
            {
                Token = token,
                BrowserFingerprint = DefaultFingerprint,
                Answers = answers,
                Result = result,
            },
            CancellationToken.None));

        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task ValidateAsync_WhenInvitationExpired_ReturnsExpiredState()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = new CandidateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "candidate.four@example.com",
                CandidateName = "Candidate Four",
                SendNotification = false,
            },
            CancellationToken.None);

        var invitation = await db.CandidateInvitations.FindAsync(Guid.Parse(created.Id));
        Assert.NotNull(invitation);
        invitation!.TokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();

        var token = ExtractToken(created.InviteLink);
        var validation = await accessService.ValidateAsync(token, CancellationToken.None);

        Assert.False(validation.IsValid);
        Assert.Equal("Expired", validation.Status);
        Assert.False(validation.CanStart);
        Assert.False(validation.CanResume);
    }

    [Fact]
    public async Task ValidateAsync_WithValidToken_IncrementsOpensCount()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = new CandidateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "candidate.opens@example.com",
                CandidateName = "Candidate Opens",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);
        var validation = await accessService.ValidateAsync(token, CancellationToken.None);

        Assert.True(validation.IsValid);
        Assert.Equal("Invited", validation.Status);

        var invitation = await db.CandidateInvitations.FindAsync(Guid.Parse(created.Id));
        Assert.NotNull(invitation);
        Assert.Equal(1, invitation!.OpensCount);
    }

    [Fact]
    public async Task StartOrResumeAsync_WhenEmailVerificationFails_ThrowsForbidden()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = new CandidateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "candidate.verify@example.com",
                CandidateName = "Candidate Verify",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);

        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "wrong.email@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None));

        Assert.Equal(403, ex.StatusCode);
    }

    [Fact]
    public async Task StartOrResumeAsync_WhenSingleUseFingerprintChanges_ThrowsConflict()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = new CandidateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "candidate.singleuse@example.com",
                CandidateName = "Candidate SingleUse",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);

        await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.singleuse@example.com",
                BrowserFingerprint = "fingerprint-A",
            },
            CancellationToken.None);

        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.singleuse@example.com",
                BrowserFingerprint = "fingerprint-B",
            },
            CancellationToken.None));

        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task StartOrResumeAsync_WhenIpLockEnabledAndIpChanges_ThrowsConflict()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = new CandidateAccessService(db);

        db.CandidateLinkSecuritySettings.Add(new CandidateLinkSecuritySettings
        {
            TestId = test.Id,
            SingleUseLinkEnabled = true,
            EmailVerificationEnabled = true,
            IpLockEnabled = true,
            BrowserFingerprintEnabled = false,
            LinkValidForValue = 7,
            LinkValidForUnit = "days",
            GracePeriodValue = 30,
            GracePeriodUnit = "minutes",
        });
        await db.SaveChangesAsync();

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "candidate.iplock@example.com",
                CandidateName = "Candidate IpLock",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);

        await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.iplock@example.com",
                BrowserFingerprint = DefaultFingerprint,
                ClientIpAddress = "10.10.10.1",
            },
            CancellationToken.None);

        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.iplock@example.com",
                BrowserFingerprint = DefaultFingerprint,
                ClientIpAddress = "10.10.10.2",
            },
            CancellationToken.None));

        Assert.Equal(409, ex.StatusCode);
    }

    private static CandidateInvitationService CreateInvitationService(AppDbContext db)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["CandidateInvitations:PublicBaseUrl"] = "https://example.test/interview/candidate/start"
            })
            .Build();

        return new CandidateInvitationService(
            db,
            configuration,
            new NoOpEmailSender(),
            NullLogger<CandidateInvitationService>.Instance);
    }

    private static async Task<Test> SeedTestAsync(AppDbContext db)
    {
        var test = new Test
        {
            Title = "Candidate Access Test",
            Description = "Secure candidate access test",
            Discipline = Discipline.Engineering,
            Status = TestStatus.Active,
            CandidateCount = 0,
            TestQuestions =
            [
                new TestQuestion
                {
                    Question = new Question
                    {
                        Title = "What is 2 + 2?",
                        Description = "Simple arithmetic",
                        Type = QuestionType.MultipleChoice,
                        Difficulty = Difficulty.Easy,
                        GradingMethod = GradingMethod.AutoGraded,
                        Points = 1,
                        DurationMinutes = 1,
                        Options =
                        [
                            new QuestionOption { Text = "3", Correct = false },
                            new QuestionOption { Text = "4", Correct = true },
                        ]
                    }
                }
            ]
        };

        db.Tests.Add(test);
        await db.SaveChangesAsync();

        return test;
    }

    private static string ExtractToken(string inviteLink)
    {
        var uri = new Uri(inviteLink);
        var query = uri.Query.TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var pair in query)
        {
            if (!pair.StartsWith("token=", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return Uri.UnescapeDataString(pair["token=".Length..]);
        }

        throw new InvalidOperationException("Invite link token is missing.");
    }

    private sealed class NoOpEmailSender : ICandidateInvitationEmailSender
    {
        public Task SendInvitationAsync(CandidateInvitationDto invitation, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }
}

using System.Text.Json;
using EY.HRPlatform.Interview.Domain;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Candidates;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Candidates;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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
        var accessService = CreateAccessService(db);

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
    public async Task StartOrResumeAsync_SurfacesProctoringFlagsOnSession()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db, proctoring: true);
        var invitationService = CreateInvitationService(db);
        var accessService = CreateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "candidate.proctor@example.com",
                CandidateName = "Proctored Candidate",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);

        var validation = await accessService.ValidateAsync(token, CancellationToken.None);
        Assert.True(validation.EnableProctoring);
        Assert.True(validation.EnableActivityMonitoring);
        Assert.True(validation.RestrictCopyPaste);

        var session = await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.proctor@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None);

        Assert.True(session.EnableProctoring);
        Assert.True(session.EnableActivityMonitoring);
        Assert.True(session.RestrictCopyPaste);
    }

    [Fact]
    public async Task StartOrResumeAsync_WhenTokenExpired_ThrowsGone()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = CreateAccessService(db);

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
        var accessService = CreateAccessService(db);

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
    public async Task StartOrResumeAsync_WhenSingleUseDisabled_AllowsReuseAfterSubmission()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = CreateAccessService(db);

        db.CandidateLinkSecuritySettings.Add(new CandidateLinkSecuritySettings
        {
            TestId = test.Id,
            SingleUseLinkEnabled = false,
            EmailVerificationEnabled = true,
            IpLockEnabled = false,
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
                Email = "candidate.reuse@example.com",
                CandidateName = "Candidate Reuse",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);

        await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.reuse@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None);

        var answers = JsonDocument.Parse("{\"responses\":[{\"questionId\":\"q1\",\"answerText\":\"answer\"}]}").RootElement.Clone();
        var result = JsonDocument.Parse("{\"score\":90}").RootElement.Clone();

        await accessService.SubmitAsync(
            new SubmitCandidateAttemptDto
            {
                Token = token,
                BrowserFingerprint = DefaultFingerprint,
                Answers = answers,
                Result = result,
            },
            CancellationToken.None);

        var resumed = await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.reuse@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None);

        Assert.Equal("InProgress", resumed.Status);

        var invitationId = Guid.Parse(created.Id);
        var attempts = await db.CandidateTestAttempts
            .Where(item => item.InvitationId == invitationId)
            .OrderBy(item => item.AttemptNumber)
            .ToListAsync();

        Assert.Equal(2, attempts.Count);
        Assert.True(attempts[0].SubmittedAtUtc.HasValue);
        Assert.False(attempts[1].SubmittedAtUtc.HasValue);
    }

    [Fact]
    public async Task StartOrResumeAsync_WhenMaxAttemptsReached_ThrowsConflict()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = CreateAccessService(db);

        db.CandidateAttemptSettings.Add(new CandidateAttemptSettings
        {
            DefaultMaxAttempts = 1,
        });

        db.CandidateLinkSecuritySettings.Add(new CandidateLinkSecuritySettings
        {
            TestId = test.Id,
            SingleUseLinkEnabled = false,
            EmailVerificationEnabled = true,
            IpLockEnabled = false,
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
                Email = "candidate.limit@example.com",
                CandidateName = "Candidate Limit",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);

        await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.limit@example.com",
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

        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.limit@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None));

        Assert.Equal(409, ex.StatusCode);
        Assert.Contains("Maximum attempts reached", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ValidateAsync_WhenInvitationExpired_ReturnsExpiredState()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = CreateAccessService(db);

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
        var accessService = CreateAccessService(db);

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
        var accessService = CreateAccessService(db);

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
        var accessService = CreateAccessService(db);

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
        var accessService = CreateAccessService(db);

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

    [Fact]
    public async Task StartOrResumeAsync_WhenPendingRetakeExists_StartsExistingAttemptWithoutCreatingNewAttempt()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = CreateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "candidate.pending@example.com",
                CandidateName = "Candidate Pending",
                SendNotification = false,
            },
            CancellationToken.None);

        var invitationId = Guid.Parse(created.Id);
        var invitation = await db.CandidateInvitations
            .Include(item => item.Attempts)
            .FirstAsync(item => item.Id == invitationId);

        var pendingAttempt = new CandidateTestAttempt
        {
            InvitationId = invitation.Id,
            AttemptNumber = 2,
            TestId = invitation.TestId,
            CandidateEmail = invitation.Email,
            CandidateName = invitation.CandidateName,
            StartedAtUtc = default,
            SubmittedAtUtc = null,
            AnswersJson = "{}",
            ResultJson = "{}",
        };

        db.CandidateTestAttempts.Add(pendingAttempt);
        invitation.Attempts.Add(pendingAttempt);
        await db.SaveChangesAsync();

        var token = ExtractToken(created.InviteLink);
        var session = await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "candidate.pending@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None);

        Assert.Equal(pendingAttempt.Id.ToString(), session.AttemptId);

        var attempts = await db.CandidateTestAttempts
            .Where(item => item.InvitationId == invitation.Id)
            .OrderBy(item => item.AttemptNumber)
            .ToListAsync();

        var startedAttempt = Assert.Single(attempts);
        Assert.Equal(2, startedAttempt.AttemptNumber);
        Assert.NotEqual(default, startedAttempt.StartedAtUtc);

        var startedEvents = await db.CandidateProgressEvents
            .Where(item =>
                item.InvitationId == invitation.Id &&
                item.AttemptNumber == 2 &&
                item.Milestone == CandidateProgressMilestones.Started)
            .ToListAsync();

        Assert.Single(startedEvents);
    }

    [Fact]
    public async Task RunCodeAsync_WithUnknownToken_Throws404()
    {
        await using var db = TestDbContextFactory.Create();
        var accessService = CreateAccessService(db);

        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.RunCodeAsync(
            new RunCodeRequestDto
            {
                Token = "0123456789abcdef0123456789abcdef", // valid format, no match
                QuestionId = Guid.NewGuid(),
                SourceCode = "print('hi')",
            },
            CancellationToken.None));

        Assert.Equal(404, ex.StatusCode);
    }

    [Fact]
    public async Task RunCodeAsync_WhenAttemptNotStarted_ThrowsConflict()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = CreateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "run.candidate@example.com",
                CandidateName = "Run Candidate",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);

        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.RunCodeAsync(
            new RunCodeRequestDto
            {
                Token = token,
                QuestionId = Guid.NewGuid(),
                SourceCode = "print('hi')",
            },
            CancellationToken.None));

        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task RunCodeAsync_WhenJudge0NotConfigured_ThrowsServiceUnavailable()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = CreateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "run.candidate@example.com",
                CandidateName = "Run Candidate",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);

        // Move the attempt to in-progress so the run gate passes.
        await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "run.candidate@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None);

        var questionId = await AddCodingQuestionAsync(db, test.Id);

        // The default service provider has no Judge0Client registered, so a valid run
        // request must degrade to 503 rather than throwing something opaque.
        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.RunCodeAsync(
            new RunCodeRequestDto
            {
                Token = token,
                QuestionId = questionId,
                SourceCode = "print('hi')",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None));

        Assert.Equal(503, ex.StatusCode);
    }

    [Fact]
    public async Task RunCodeAsync_MultiFile_WhenJudge0NotConfigured_ThrowsServiceUnavailable()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = CreateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "run.candidate@example.com",
                CandidateName = "Run Candidate",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);
        await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "run.candidate@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None);

        var questionId = await AddCodingQuestionAsync(db, test.Id);

        // A multi-file request (no SourceCode) must be accepted past validation and reach the
        // Judge0 gate — i.e. the optional-SourceCode change didn't break the run path.
        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.RunCodeAsync(
            new RunCodeRequestDto
            {
                Token = token,
                QuestionId = questionId,
                BrowserFingerprint = DefaultFingerprint,
                EntryPath = "main.py",
                Files =
                [
                    new ProjectFileDto { Path = "main.py", Content = "import util\nprint(util.x)" },
                    new ProjectFileDto { Path = "util.py", Content = "x = 1" },
                ],
            },
            CancellationToken.None));

        Assert.Equal(503, ex.StatusCode);
    }

    [Fact]
    public async Task RunCodeAsync_ForNonCodeQuestion_ThrowsBadRequest()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = CreateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "run.candidate@example.com",
                CandidateName = "Run Candidate",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);

        await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "run.candidate@example.com",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None);

        // The seeded question is a Multiple Choice question — not runnable.
        var questionId = test.TestQuestions.First().Question!.Id;

        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.RunCodeAsync(
            new RunCodeRequestDto
            {
                Token = token,
                QuestionId = questionId,
                SourceCode = "print('hi')",
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None));

        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task RunCodeAsync_WhenFingerprintDiffersFromBoundAttempt_ThrowsConflict()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var invitationService = CreateInvitationService(db);
        var accessService = CreateAccessService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "run.candidate@example.com",
                CandidateName = "Run Candidate",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);

        // Bind the invitation to fingerprint-A on start.
        await accessService.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = "run.candidate@example.com",
                BrowserFingerprint = "fingerprint-A",
            },
            CancellationToken.None);

        var questionId = await AddCodingQuestionAsync(db, test.Id);

        // A run from a different browser (fingerprint-B) must be rejected before any execution —
        // a leaked token can't run code outside the browser that started the attempt.
        var ex = await Assert.ThrowsAsync<ApiException>(() => accessService.RunCodeAsync(
            new RunCodeRequestDto
            {
                Token = token,
                QuestionId = questionId,
                SourceCode = "print('hi')",
                BrowserFingerprint = "fingerprint-B",
            },
            CancellationToken.None));

        Assert.Equal(409, ex.StatusCode);
    }

    private static async Task<Guid> AddCodingQuestionAsync(AppDbContext db, Guid testId)
    {
        var question = new Question
        {
            Title = "Reverse a string",
            Description = "Return the reversed string.",
            Type = QuestionType.Coding,
            Difficulty = Difficulty.Easy,
            GradingMethod = GradingMethod.AutoGraded,
            Points = 10,
            DurationMinutes = 10,
            Language = "python",
        };
        db.Questions.Add(question);
        db.TestQuestions.Add(new TestQuestion { TestId = testId, Question = question });
        await db.SaveChangesAsync();
        return question.Id;
    }

    private static CandidateAccessService CreateAccessService(AppDbContext db, IServiceProvider? services = null)
    {
        var provider = services ?? new ServiceCollection().BuildServiceProvider();
        var runThrottle = new CodeRunThrottle(
            new ConfigurationBuilder().Build(),
            NullLogger<CodeRunThrottle>.Instance);
        return new CandidateAccessService(
            db,
            provider,
            runThrottle,
            CreateProctoringThrottle(),
            NullLogger<CandidateAccessService>.Instance);
    }

    // Mirrors the "Proctoring" DI profile: no min-interval, so proctoring tests can post back-to-back.
    private static CodeRunThrottle CreateProctoringThrottle() =>
        new(
            new ConfigurationBuilder().Build(),
            NullLogger<CodeRunThrottle>.Instance,
            section: "Proctoring",
            defaultMaxConcurrent: 64,
            defaultMinIntervalSeconds: 0,
            defaultMaxRunsPerMinute: 60,
            defaultMaxRunSeconds: 10);

    // ── Proctoring ingestion (Phase 2) ─────────────────────────────────────────────

    [Fact]
    public async Task SubmitProctoringEventsAsync_StoresEventsAndSetsHeartbeat()
    {
        await using var db = TestDbContextFactory.Create();
        var (access, token, attemptId) = await SeedStartedAttemptAsync(db);

        var result = await access.SubmitProctoringEventsAsync(
            new SubmitProctoringEventsDto
            {
                Token = token,
                BrowserFingerprint = DefaultFingerprint,
                Heartbeat = true,
                Events =
                [
                    Ev(ProctoringEventTypes.TabFocusLoss, "e1"),
                    Ev(ProctoringEventTypes.SecondPerson, "e2", confidence: 0.9),
                ],
            },
            CancellationToken.None);

        Assert.Equal(2, result.Accepted);
        Assert.Equal(0, result.Deduplicated);
        Assert.NotNull(result.HeartbeatAtUtc);

        Assert.Equal(2, db.CandidateProctoringEvents.Count(e => e.AttemptId == attemptId));
        var attempt = await db.CandidateTestAttempts.FindAsync(attemptId);
        Assert.NotNull(attempt!.LastProctorHeartbeatUtc);
    }

    [Fact]
    public async Task SubmitProctoringEventsAsync_IsIdempotentOnResend()
    {
        await using var db = TestDbContextFactory.Create();
        var (access, token, attemptId) = await SeedStartedAttemptAsync(db);

        var batch = new SubmitProctoringEventsDto
        {
            Token = token,
            BrowserFingerprint = DefaultFingerprint,
            Events = [Ev(ProctoringEventTypes.Paste, "dup-1"), Ev(ProctoringEventTypes.Copy, "dup-2")],
        };

        var first = await access.SubmitProctoringEventsAsync(batch, CancellationToken.None);
        var second = await access.SubmitProctoringEventsAsync(batch, CancellationToken.None);

        Assert.Equal(2, first.Accepted);
        Assert.Equal(0, second.Accepted);
        Assert.Equal(2, second.Deduplicated);
        Assert.Equal(2, db.CandidateProctoringEvents.Count(e => e.AttemptId == attemptId));
    }

    [Fact]
    public async Task SubmitProctoringEventsAsync_DedupesWithinASingleBatch()
    {
        await using var db = TestDbContextFactory.Create();
        var (access, token, _) = await SeedStartedAttemptAsync(db);

        var result = await access.SubmitProctoringEventsAsync(
            new SubmitProctoringEventsDto
            {
                Token = token,
                BrowserFingerprint = DefaultFingerprint,
                Events = [Ev(ProctoringEventTypes.Copy, "same"), Ev(ProctoringEventTypes.Cut, "same")],
            },
            CancellationToken.None);

        Assert.Equal(1, result.Accepted);
    }

    [Fact]
    public async Task SubmitProctoringEventsAsync_DropsEventsForDisabledLayers()
    {
        await using var db = TestDbContextFactory.Create();
        var (access, token, attemptId) = await SeedStartedAttemptAsync(db);

        // Author disables the webcam layer (keeps activity monitoring on).
        var test = db.Tests.Single();
        test.EnableProctoring = false;
        await db.SaveChangesAsync();

        var result = await access.SubmitProctoringEventsAsync(
            new SubmitProctoringEventsDto
            {
                Token = token,
                BrowserFingerprint = DefaultFingerprint,
                Events =
                [
                    Ev(ProctoringEventTypes.TabFocusLoss, "activity"),       // enabled → stored
                    Ev(ProctoringEventTypes.SecondPerson, "webcam", confidence: 0.9), // disabled → dropped
                ],
            },
            CancellationToken.None);

        Assert.Equal(1, result.Accepted);
        Assert.Equal(1, result.Dropped);
        Assert.Equal(1, db.CandidateProctoringEvents.Count(e => e.AttemptId == attemptId));
        Assert.Equal(
            ProctoringEventTypes.TabFocusLoss,
            db.CandidateProctoringEvents.Single(e => e.AttemptId == attemptId).Type);
    }

    [Fact]
    public async Task SubmitProctoringEventsAsync_HeartbeatOnly_AcceptsZeroAndStampsHeartbeat()
    {
        await using var db = TestDbContextFactory.Create();
        var (access, token, attemptId) = await SeedStartedAttemptAsync(db);

        var result = await access.SubmitProctoringEventsAsync(
            new SubmitProctoringEventsDto { Token = token, BrowserFingerprint = DefaultFingerprint, Heartbeat = true },
            CancellationToken.None);

        Assert.Equal(0, result.Accepted);
        Assert.NotNull(result.HeartbeatAtUtc);
        var attempt = await db.CandidateTestAttempts.FindAsync(attemptId);
        Assert.NotNull(attempt!.LastProctorHeartbeatUtc);
    }

    [Fact]
    public async Task SubmitProctoringEventsAsync_WhenBatchTooLarge_Throws400()
    {
        await using var db = TestDbContextFactory.Create();
        var (access, token, _) = await SeedStartedAttemptAsync(db);

        var events = Enumerable.Range(0, ProctoringIngestLimits.MaxBatchSize + 1)
            .Select(i => Ev(ProctoringEventTypes.TabFocusLoss, $"e{i}"))
            .ToList();

        var ex = await Assert.ThrowsAsync<ApiException>(() => access.SubmitProctoringEventsAsync(
            new SubmitProctoringEventsDto { Token = token, BrowserFingerprint = DefaultFingerprint, Events = events },
            CancellationToken.None));

        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task SubmitProctoringEventsAsync_WhenUnknownType_Throws400()
    {
        await using var db = TestDbContextFactory.Create();
        var (access, token, _) = await SeedStartedAttemptAsync(db);

        var ex = await Assert.ThrowsAsync<ApiException>(() => access.SubmitProctoringEventsAsync(
            new SubmitProctoringEventsDto
            {
                Token = token,
                BrowserFingerprint = DefaultFingerprint,
                Events = [Ev("teleporting", "e1")],
            },
            CancellationToken.None));

        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task SubmitProctoringEventsAsync_WhenConfidenceOutOfRange_Throws400()
    {
        await using var db = TestDbContextFactory.Create();
        var (access, token, _) = await SeedStartedAttemptAsync(db);

        var ex = await Assert.ThrowsAsync<ApiException>(() => access.SubmitProctoringEventsAsync(
            new SubmitProctoringEventsDto
            {
                Token = token,
                BrowserFingerprint = DefaultFingerprint,
                Events = [Ev(ProctoringEventTypes.LookingAway, "e1", confidence: 1.5)],
            },
            CancellationToken.None));

        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task SubmitProctoringEventsAsync_WhenTimestampOutsideWindow_Throws400()
    {
        await using var db = TestDbContextFactory.Create();
        var (access, token, _) = await SeedStartedAttemptAsync(db);

        var ex = await Assert.ThrowsAsync<ApiException>(() => access.SubmitProctoringEventsAsync(
            new SubmitProctoringEventsDto
            {
                Token = token,
                BrowserFingerprint = DefaultFingerprint,
                Events = [Ev(ProctoringEventTypes.TabFocusLoss, "e1", start: DateTime.UtcNow.AddHours(1))],
            },
            CancellationToken.None));

        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public async Task SubmitProctoringEventsAsync_WhenNotStarted_Throws409()
    {
        await using var db = TestDbContextFactory.Create();
        var test = await SeedTestAsync(db);
        var access = CreateProctorAccessService(db);
        var invitationService = CreateInvitationService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = "not.started@example.com",
                CandidateName = "Not Started",
                SendNotification = false,
            },
            CancellationToken.None);
        var token = ExtractToken(created.InviteLink);

        var ex = await Assert.ThrowsAsync<ApiException>(() => access.SubmitProctoringEventsAsync(
            new SubmitProctoringEventsDto
            {
                Token = token,
                BrowserFingerprint = DefaultFingerprint,
                Events = [Ev(ProctoringEventTypes.TabFocusLoss, "e1")],
            },
            CancellationToken.None));

        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task SubmitProctoringEventsAsync_WhenFingerprintChanges_ThrowsConflict()
    {
        await using var db = TestDbContextFactory.Create();
        var (access, token, _) = await SeedStartedAttemptAsync(db, singleUse: true);

        var ex = await Assert.ThrowsAsync<ApiException>(() => access.SubmitProctoringEventsAsync(
            new SubmitProctoringEventsDto
            {
                Token = token,
                BrowserFingerprint = "a-different-browser-fingerprint",
                Events = [Ev(ProctoringEventTypes.TabFocusLoss, "e1")],
            },
            CancellationToken.None));

        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task RetentionDelete_RemovesProctoringEvents()
    {
        await using var db = TestDbContextFactory.Create();
        var (access, token, attemptId) = await SeedStartedAttemptAsync(db, email: "purge.me@example.com");

        await access.SubmitProctoringEventsAsync(
            new SubmitProctoringEventsDto
            {
                Token = token,
                BrowserFingerprint = DefaultFingerprint,
                Events = [Ev(ProctoringEventTypes.SecondPerson, "e1", confidence: 0.8)],
            },
            CancellationToken.None);
        Assert.Equal(1, db.CandidateProctoringEvents.Count(e => e.AttemptId == attemptId));

        // Simulate the retention "Delete" in-memory branch: remove the attempt's proctoring events
        // alongside the attempt, mirroring CandidateRetentionService.
        var attemptIds = new[] { attemptId };
        var proctoring = await db.CandidateProctoringEvents
            .Where(e => attemptIds.Contains(e.AttemptId)).ToListAsync();
        db.CandidateProctoringEvents.RemoveRange(proctoring);
        var attempts = await db.CandidateTestAttempts.Where(a => attemptIds.Contains(a.Id)).ToListAsync();
        db.CandidateTestAttempts.RemoveRange(attempts);
        await db.SaveChangesAsync();

        Assert.Equal(0, db.CandidateProctoringEvents.Count(e => e.AttemptId == attemptId));
    }

    private static ProctoringEventInputDto Ev(
        string type, string? clientEventId = null, double? confidence = null, DateTime? start = null) =>
        new()
        {
            ClientEventId = clientEventId ?? Guid.NewGuid().ToString("N"),
            Type = type,
            Confidence = confidence,
            StartedAtUtc = start ?? DateTime.UtcNow,
        };

    /// <summary>Access service whose throttle has no min-interval, so a test can post two
    /// proctoring batches back-to-back without tripping the per-attempt rate limit.</summary>
    // Proctoring now has its own no-min-interval throttle inside the service, so the standard access
    // service already lets proctoring tests post back-to-back.
    private static CandidateAccessService CreateProctorAccessService(AppDbContext db) => CreateAccessService(db);

    private static async Task<(CandidateAccessService Access, string Token, Guid AttemptId)> SeedStartedAttemptAsync(
        AppDbContext db, string email = "proctor@example.com", bool singleUse = false)
    {
        // Proctoring layers must be enabled or the ingestion endpoint drops every event.
        var test = await SeedTestAsync(db, proctoring: true);
        if (singleUse)
        {
            db.CandidateLinkSecuritySettings.Add(new CandidateLinkSecuritySettings
            {
                TestId = test.Id,
                SingleUseLinkEnabled = true,
                BrowserFingerprintEnabled = true,
            });
            await db.SaveChangesAsync();
        }

        var access = CreateProctorAccessService(db);
        var invitationService = CreateInvitationService(db);

        var created = await invitationService.CreateAsync(
            new CreateCandidateInvitationDto
            {
                TestId = test.Id.ToString(),
                Email = email,
                CandidateName = "Proctored",
                SendNotification = false,
            },
            CancellationToken.None);

        var token = ExtractToken(created.InviteLink);
        var session = await access.StartOrResumeAsync(
            new StartCandidateAttemptDto
            {
                Token = token,
                CandidateEmail = email,
                BrowserFingerprint = DefaultFingerprint,
            },
            CancellationToken.None);

        return (access, token, Guid.Parse(session.AttemptId));
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

    private static async Task<Test> SeedTestAsync(AppDbContext db, bool proctoring = false)
    {
        var test = new Test
        {
            Title = "Candidate Access Test",
            Description = "Secure candidate access test",
            Discipline = Discipline.Engineering,
            Status = TestStatus.Active,
            CandidateCount = 0,
            EnableProctoring = proctoring,
            EnableActivityMonitoring = proctoring,
            RestrictCopyPaste = proctoring,
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

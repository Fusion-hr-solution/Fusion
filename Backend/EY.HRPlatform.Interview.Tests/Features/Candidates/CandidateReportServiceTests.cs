using System.Text;
using EY.HRPlatform.Interview.Domain;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Features.Candidates;
using EY.HRPlatform.Interview.Infrastructure;
using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Interview.Tests.Features.Candidates;

public class CandidateReportServiceTests
{
    [Fact]
    public async Task GetCandidateReport_WithTaggedQuestions_GroupsByTagAndSurfacesPassMark()
    {
        await using var db = TestDbContextFactory.Create();
        var (test, questions) = await SeedTestAsync(db, passingThreshold: 70, specs:
        [
            new QSpec(["algorithms"], QuestionType.Coding, MaxScore: 10),
            new QSpec(["databases"], QuestionType.Sql, MaxScore: 10),
            new QSpec(["frontend"], QuestionType.Coding, MaxScore: 10),
        ]);
        await AddGradedAttemptAsync(db, test, questions, scores: [8m, 5m, 9m], email: "cand@example.com");

        var service = CreateService(db);
        var report = await service.GetCandidateReportAsync(
            test.Id.ToString(), "cand@example.com", attemptNumber: null, CancellationToken.None);

        Assert.Equal("tag", report.AxisKind);
        Assert.Equal(70, report.PassingThreshold);
        Assert.Equal(22m, report.TotalScore);
        Assert.Equal(30m, report.MaxScore);
        Assert.Equal("Completed", report.GradingStatus);
        Assert.Equal(3, report.Skills.Count);
        Assert.Equal(80d, report.Skills.Single(s => s.Key == "algorithms").ScorePct);
        Assert.Equal(50d, report.Skills.Single(s => s.Key == "databases").ScorePct);
        Assert.Equal(90d, report.Skills.Single(s => s.Key == "frontend").ScorePct);
    }

    [Fact]
    public async Task GetCandidateReport_WhenTagsSparse_FallsBackToQuestionType()
    {
        await using var db = TestDbContextFactory.Create();
        // Only two distinct tags across the attempt (< 3) → the profile groups by question type instead.
        var (test, questions) = await SeedTestAsync(db, passingThreshold: 60, specs:
        [
            new QSpec(["misc"], QuestionType.Coding, MaxScore: 10),
            new QSpec(["misc"], QuestionType.Essay, MaxScore: 10),
        ]);
        await AddGradedAttemptAsync(db, test, questions, scores: [10m, 4m], email: "fallback@example.com");

        var service = CreateService(db);
        var report = await service.GetCandidateReportAsync(
            test.Id.ToString(), "fallback@example.com", attemptNumber: null, CancellationToken.None);

        Assert.Equal("type", report.AxisKind);
        Assert.Equal(2, report.Skills.Count);
        Assert.Equal(100d, report.Skills.Single(s => s.Key == "Coding").ScorePct);
        Assert.Equal(40d, report.Skills.Single(s => s.Key == "Essay").ScorePct);
    }

    [Fact]
    public async Task GetCandidateReport_WithMultiTagQuestion_AddsScoreToEveryTag()
    {
        await using var db = TestDbContextFactory.Create();
        var (test, questions) = await SeedTestAsync(db, specs:
        [
            new QSpec(["algo", "ds"], QuestionType.Coding, MaxScore: 10),
            new QSpec(["algo"], QuestionType.Coding, MaxScore: 10),
            new QSpec(["db"], QuestionType.Sql, MaxScore: 10),
        ]);
        await AddGradedAttemptAsync(db, test, questions, scores: [10m, 5m, 0m], email: "multi@example.com");

        var service = CreateService(db);
        var report = await service.GetCandidateReportAsync(
            test.Id.ToString(), "multi@example.com", attemptNumber: null, CancellationToken.None);

        Assert.Equal("tag", report.AxisKind);
        var algo = report.Skills.Single(s => s.Key == "algo");
        Assert.Equal(2, algo.QuestionCount);           // both algo questions
        Assert.Equal(75d, algo.ScorePct);              // (10 + 5) / (10 + 10)
        Assert.Equal(100d, report.Skills.Single(s => s.Key == "ds").ScorePct);   // shares q1
        Assert.Equal(0d, report.Skills.Single(s => s.Key == "db").ScorePct);
    }

    [Fact]
    public async Task GetCandidateReport_WhenCohortBelowFloor_ReportsBenchmarkingUnavailable()
    {
        await using var db = TestDbContextFactory.Create();
        var (test, questions) = await SeedTestAsync(db, specs:
        [
            new QSpec(["algorithms"], QuestionType.Coding, MaxScore: 10),
            new QSpec(["databases"], QuestionType.Sql, MaxScore: 10),
            new QSpec(["frontend"], QuestionType.Coding, MaxScore: 10),
        ]);
        await AddGradedAttemptAsync(db, test, questions, scores: [8m, 8m, 8m], email: "cand@example.com");
        for (var i = 0; i < 5; i++)
        {
            await AddGradedAttemptAsync(db, test, questions, scores: [6m, 6m, 6m], email: $"peer{i}@example.com");
        }

        var service = CreateService(db);
        var report = await service.GetCandidateReportAsync(
            test.Id.ToString(), "cand@example.com", attemptNumber: null, CancellationToken.None);

        Assert.False(report.CohortAvailable);
        Assert.Equal(6, report.CohortSize);
        Assert.Null(report.OverallCohortAvgPct);
        Assert.NotNull(report.CohortUnavailableReason);
        Assert.All(report.Skills, skill => Assert.Null(skill.CohortAvgPct));
    }

    [Fact]
    public async Task GetCandidateReport_WhenCohortMeetsFloor_ComputesBenchmarks()
    {
        await using var db = TestDbContextFactory.Create();
        var (test, questions) = await SeedTestAsync(db, specs:
        [
            new QSpec(["algorithms"], QuestionType.Coding, MaxScore: 10),
            new QSpec(["databases"], QuestionType.Sql, MaxScore: 10),
            new QSpec(["frontend"], QuestionType.Coding, MaxScore: 10),
        ]);
        // Candidate scores 90% everywhere; the 14 peers score a uniform 60% → cohort mean 60%.
        await AddGradedAttemptAsync(db, test, questions, scores: [9m, 9m, 9m], email: "cand@example.com");
        for (var i = 0; i < 14; i++)
        {
            await AddGradedAttemptAsync(db, test, questions, scores: [6m, 6m, 6m], email: $"peer{i}@example.com");
        }

        var service = CreateService(db);
        var report = await service.GetCandidateReportAsync(
            test.Id.ToString(), "cand@example.com", attemptNumber: null, CancellationToken.None);

        Assert.True(report.CohortAvailable);
        Assert.Equal(15, report.CohortSize);
        Assert.NotNull(report.OverallCohortAvgPct);
        // Cohort mean = (14 peers @ 60% + 1 candidate @ 90%) / 15 = 62%.
        Assert.Equal(62d, report.OverallCohortAvgPct);
        var algo = report.Skills.Single(s => s.Key == "algorithms");
        Assert.NotNull(algo.CohortAvgPct);
        // Pooled points: (14*6 + 9) / (15*10) = 93/150 = 62%.
        Assert.Equal(62d, algo.CohortAvgPct);
    }

    [Fact]
    public async Task GetCandidateReport_WhenAxisThinlyCovered_SuppressesThatAxisBenchmarkOnly()
    {
        await using var db = TestDbContextFactory.Create();
        var (test, questions) = await SeedTestAsync(db, specs:
        [
            new QSpec(["algorithms"], QuestionType.Coding, MaxScore: 10),
            new QSpec(["databases"], QuestionType.Sql, MaxScore: 10),
            new QSpec(["frontend"], QuestionType.Coding, MaxScore: 10),
            new QSpec(["security"], QuestionType.Coding, MaxScore: 10),
        ]);

        // "security" models a recently added question: the candidate answered it, the 14 peers
        // sat the test before it existed. The cohort clears the floor overall, but that one axis
        // is backed by a single attempt — the candidate's own.
        var established = questions.Take(3).ToList();
        await AddGradedAttemptAsync(db, test, questions, scores: [9m, 9m, 9m, 9m], email: "cand@example.com");
        for (var i = 0; i < 14; i++)
        {
            await AddGradedAttemptAsync(db, test, established, scores: [6m, 6m, 6m], email: $"peer{i}@example.com");
        }

        var service = CreateService(db);
        var report = await service.GetCandidateReportAsync(
            test.Id.ToString(), "cand@example.com", attemptNumber: null, CancellationToken.None);

        Assert.True(report.CohortAvailable);
        Assert.Equal(15, report.CohortSize);

        // Broadly covered axes still benchmark: (14*6 + 9) / (15*10) = 62%.
        Assert.Equal(62d, report.Skills.Single(s => s.Key == "algorithms").CohortAvgPct);

        // The thin axis must not report a "cohort average" that is really one candidate's score.
        Assert.Null(report.Skills.Single(s => s.Key == "security").CohortAvgPct);
    }

    [Fact]
    public async Task GetCandidateReport_WhenProctoringEventsExist_ReusesProctoringSummary()
    {
        await using var db = TestDbContextFactory.Create();
        var (test, questions) = await SeedTestAsync(db, proctoring: true, specs:
        [
            new QSpec(["algorithms"], QuestionType.Coding, MaxScore: 10),
        ]);
        var attempt = await AddGradedAttemptAsync(db, test, questions, scores: [8m], email: "proctor@example.com");

        db.CandidateProctoringEvents.Add(new CandidateProctoringEvent
        {
            AttemptId = attempt.Id,
            Type = ProctoringEventTypes.SecondPerson,
            ClientEventId = "e1",
            Confidence = 0.9,
            StartedAtUtc = DateTime.UtcNow.AddMinutes(-10),
            ServerReceivedAtUtc = DateTime.UtcNow.AddMinutes(-10),
        });
        db.CandidateProctoringEvents.Add(new CandidateProctoringEvent
        {
            AttemptId = attempt.Id,
            Type = ProctoringEventTypes.TabFocusLoss,
            ClientEventId = "e2",
            StartedAtUtc = DateTime.UtcNow.AddMinutes(-9),
            ServerReceivedAtUtc = DateTime.UtcNow.AddMinutes(-9),
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var report = await service.GetCandidateReportAsync(
            test.Id.ToString(), "proctor@example.com", attemptNumber: null, CancellationToken.None);

        Assert.NotNull(report.Proctoring);
        Assert.True(report.Proctoring!.Enabled);
        Assert.Equal(2, report.Proctoring.TotalEvents);
        Assert.Equal(2, report.Proctoring.CountsByType.Count);
    }

    [Fact]
    public async Task GetCandidateReport_WhenTimingCaptured_AggregatesSecondsPerAxis()
    {
        await using var db = TestDbContextFactory.Create();
        var (test, questions) = await SeedTestAsync(db, specs:
        [
            new QSpec(["algorithms"], QuestionType.Coding, MaxScore: 10),
            new QSpec(["databases"], QuestionType.Sql, MaxScore: 10),
            new QSpec(["frontend"], QuestionType.Coding, MaxScore: 10),
        ]);
        var answers = BuildAnswersJson(questions, secondsSpent: [120, 60, 30]);
        await AddGradedAttemptAsync(db, test, questions, scores: [8m, 5m, 9m], email: "timed@example.com", answersJson: answers);

        var service = CreateService(db);
        var report = await service.GetCandidateReportAsync(
            test.Id.ToString(), "timed@example.com", attemptNumber: null, CancellationToken.None);

        Assert.Equal(210, report.TotalDurationSeconds);
        Assert.Equal(120, report.Skills.Single(s => s.Key == "algorithms").SecondsSpent);
        Assert.Equal(60, report.Skills.Single(s => s.Key == "databases").SecondsSpent);
    }

    [Fact]
    public async Task GetCandidateReport_WhenNoTimingCaptured_LeavesDurationNull()
    {
        await using var db = TestDbContextFactory.Create();
        var (test, questions) = await SeedTestAsync(db, specs:
        [
            new QSpec(["algorithms"], QuestionType.Coding, MaxScore: 10),
        ]);
        await AddGradedAttemptAsync(db, test, questions, scores: [8m], email: "notiming@example.com");

        var service = CreateService(db);
        var report = await service.GetCandidateReportAsync(
            test.Id.ToString(), "notiming@example.com", attemptNumber: null, CancellationToken.None);

        Assert.Null(report.TotalDurationSeconds);
        Assert.All(report.Skills, skill => Assert.Null(skill.SecondsSpent));
    }

    [Fact]
    public async Task GetCandidateReport_WithAttemptNumber_SelectsThatAttempt()
    {
        await using var db = TestDbContextFactory.Create();
        var (test, questions) = await SeedTestAsync(db, specs:
        [
            new QSpec(["algorithms"], QuestionType.Coding, MaxScore: 10),
        ]);
        var attempt1 = await AddGradedAttemptAsync(
            db, test, questions, scores: [3m], email: "retry@example.com", attemptNumber: 1);
        await AddGradedAttemptAsync(
            db, test, questions, scores: [9m], email: "retry@example.com", attemptNumber: 2,
            invitation: attempt1.Invitation);

        var service = CreateService(db);

        var first = await service.GetCandidateReportAsync(
            test.Id.ToString(), "retry@example.com", attemptNumber: 1, CancellationToken.None);
        var latest = await service.GetCandidateReportAsync(
            test.Id.ToString(), "retry@example.com", attemptNumber: null, CancellationToken.None);

        Assert.Equal(1, first.AttemptNumber);
        Assert.Equal(3m, first.TotalScore);
        Assert.Equal(2, latest.AttemptNumber);   // null → most recent
        Assert.Equal(9m, latest.TotalScore);
    }

    [Fact]
    public async Task GetCandidateReport_WhenNoAttempt_Throws404()
    {
        await using var db = TestDbContextFactory.Create();
        var (test, _) = await SeedTestAsync(db, specs:
        [
            new QSpec(["algorithms"], QuestionType.Coding, MaxScore: 10),
        ]);
        // Invitation with no attempts at all.
        db.CandidateInvitations.Add(new CandidateInvitation
        {
            TestId = test.Id,
            TestTitle = test.Title,
            Email = "invited@example.com",
            CandidateName = "Invited Only",
            Status = "Invited",
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetCandidateReportAsync(
            test.Id.ToString(), "invited@example.com", attemptNumber: null, CancellationToken.None));

        Assert.Equal(404, ex.StatusCode);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private sealed record QSpec(string[] Tags, QuestionType Type, decimal MaxScore, int DurationMinutes = 10);

    private static CandidateManagementService CreateService(AppDbContext db) =>
        // The report path touches only the DbContext; the other collaborators are never called for it.
        new(
            db,
            invitationService: null!,
            emailSender: null!,
            privacyExecutor: null!,
            retentionService: null!,
            new ConfigurationBuilder().Build(),
            NullLogger<CandidateManagementService>.Instance);

    private static async Task<(Test Test, List<Question> Questions)> SeedTestAsync(
        AppDbContext db,
        IReadOnlyList<QSpec> specs,
        int? passingThreshold = 70,
        bool proctoring = false)
    {
        var questions = new List<Question>();
        var testQuestions = new List<TestQuestion>();
        foreach (var spec in specs)
        {
            var question = new Question
            {
                Title = "Q",
                Description = "d",
                Type = spec.Type,
                Difficulty = Difficulty.Easy,
                GradingMethod = GradingMethod.AutoGraded,
                Points = (int)spec.MaxScore,
                DurationMinutes = spec.DurationMinutes,
                Tags = spec.Tags.ToList(),
            };
            questions.Add(question);
            testQuestions.Add(new TestQuestion { Question = question });
        }

        var test = new Test
        {
            Title = "Report Test",
            Description = "d",
            Discipline = Discipline.Engineering,
            Status = TestStatus.Active,
            PassingThreshold = passingThreshold,
            EnableProctoring = proctoring,
            EnableActivityMonitoring = proctoring,
            RestrictCopyPaste = proctoring,
            TestQuestions = testQuestions,
        };

        db.Tests.Add(test);
        await db.SaveChangesAsync();
        return (test, questions);
    }

    private static async Task<CandidateTestAttempt> AddGradedAttemptAsync(
        AppDbContext db,
        Test test,
        List<Question> questions,
        decimal[] scores,
        string email,
        int attemptNumber = 1,
        GradingStatus gradingStatus = GradingStatus.Completed,
        bool submitted = true,
        string? answersJson = null,
        CandidateInvitation? invitation = null)
    {
        // Retakes hang additional attempts off the SAME invitation; pass one in to model that.
        var isNewInvitation = invitation is null;
        invitation ??= new CandidateInvitation
        {
            TestId = test.Id,
            TestTitle = test.Title,
            Email = email,
            CandidateName = "Candidate",
            Status = submitted ? "Submitted" : "InProgress",
        };

        var total = scores.Sum();
        var max = questions.Sum(question => (decimal)question.Points);

        var attempt = new CandidateTestAttempt
        {
            InvitationId = invitation.Id,
            TestId = test.Id,
            AttemptNumber = attemptNumber,
            CandidateEmail = email,
            CandidateName = "Candidate",
            StartedAtUtc = DateTime.UtcNow.AddMinutes(-30),
            SubmittedAtUtc = submitted ? DateTime.UtcNow.AddMinutes(-1) : null,
            AnswersJson = answersJson ?? "{}",
            ResultJson = "{}",
            GradingStatus = gradingStatus,
            TotalScore = total,
            MaxScore = max,
            Invitation = invitation,
        };
        invitation.Attempts.Add(attempt);

        if (isNewInvitation)
        {
            db.CandidateInvitations.Add(invitation);
        }

        db.CandidateTestAttempts.Add(attempt);

        for (var i = 0; i < questions.Count; i++)
        {
            db.QuestionGradeResults.Add(new QuestionGradeResult
            {
                AttemptId = attempt.Id,
                QuestionId = questions[i].Id,
                GraderType = "auto",
                Score = scores[i],
                MaxScore = questions[i].Points,
            });
        }

        await db.SaveChangesAsync();
        return attempt;
    }

    private static string BuildAnswersJson(List<Question> questions, int[] secondsSpent)
    {
        var builder = new StringBuilder("{\"responses\":[");
        for (var i = 0; i < questions.Count; i++)
        {
            if (i > 0)
            {
                builder.Append(',');
            }

            builder.Append("{\"questionId\":\"")
                .Append(questions[i].Id)
                .Append("\",\"answerText\":\"x\",\"secondsSpent\":")
                .Append(secondsSpent[i])
                .Append('}');
        }

        builder.Append("]}");
        return builder.ToString();
    }
}

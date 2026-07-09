using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Commands.FinalizeFeedbackWindow;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Feedback;

public sealed class FinalizeFeedbackWindowCommandHandlerTests
{
    [Fact]
    public async Task Finalize_SubmittedResponse_LocksResponse()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, now);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        await db.SaveChangesAsync();

        var content = FeedbackResponseContent.Create(tenantId, cycle.Id, subjectId, CampaignWorkItemType.PeerFeedback, Guid.NewGuid(),
            [new FeedbackPromptAnswerInput(Guid.NewGuid(), "Q1", 1, "Answer", true)]);
        content.Submit(now);
        db.FeedbackResponseContents.Add(content);
        await db.SaveChangesAsync();
        var handler = new FinalizeFeedbackWindowCommandHandler(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() });

        var result = await handler.Handle(new FinalizeFeedbackWindowCommand(cycle.Id, "PeerFeedback", subjectId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(FeedbackResponseStatus.Locked, content.Status);
    }

    [Fact]
    public async Task Finalize_CycleNotFound_InvalidCycleId_ReturnsNotFound()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var handler = new FinalizeFeedbackWindowCommandHandler(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() });

        var result = await handler.Handle(new FinalizeFeedbackWindowCommand(Guid.NewGuid(), "PeerFeedback", Guid.NewGuid()), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotFound", result.Error.Code);
    }


    [Fact]
    public async Task Finalize_NoResponses_ThresholdSuppressed_ReturnsSuccess()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, now);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        await db.SaveChangesAsync();
        var handler = new FinalizeFeedbackWindowCommandHandler(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() });

        var result = await handler.Handle(new FinalizeFeedbackWindowCommand(cycle.Id, "PeerFeedback", subjectId), default);

        // No responses = validCount 0 < threshold → suppressed but still success
        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Finalize_AllInvalidated_ThresholdNotMet_SuppressesFeedback()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, now);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        await db.SaveChangesAsync();

        var content = FeedbackResponseContent.Create(tenantId, cycle.Id, subjectId, CampaignWorkItemType.PeerFeedback, Guid.NewGuid(),
            [new FeedbackPromptAnswerInput(Guid.NewGuid(), "Q1", 1, "Answer", true)]);
        content.Submit(now);
        content.Invalidate("Spam");
        db.FeedbackResponseContents.Add(content);
        await db.SaveChangesAsync();
        var handler = new FinalizeFeedbackWindowCommandHandler(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() });

        var result = await handler.Handle(new FinalizeFeedbackWindowCommand(cycle.Id, "PeerFeedback", subjectId), default);

        Assert.True(result.IsSuccess); // Suppressed but no error
    }

    [Fact]
    public async Task Finalize_ThresholdMet_LocksResponsesAndEmitsReachedAudit()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, now);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        await db.SaveChangesAsync();

        var responses = new[]
        {
            CreateSubmittedContent(tenantId, cycle.Id, subjectId, now),
            CreateSubmittedContent(tenantId, cycle.Id, subjectId, now),
            CreateSubmittedContent(tenantId, cycle.Id, subjectId, now)
        };
        db.FeedbackResponseContents.AddRange(responses);
        await db.SaveChangesAsync();
        var handler = new FinalizeFeedbackWindowCommandHandler(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() });

        var result = await handler.Handle(new FinalizeFeedbackWindowCommand(cycle.Id, "PeerFeedback", subjectId), default);

        Assert.True(result.IsSuccess);
        Assert.All(responses, response => Assert.Equal(FeedbackResponseStatus.Locked, response.Status));
        Assert.Single(db.PerformanceCycleAuditEvents, e => e.Action == PerformanceCycleAuditAction.FeedbackThresholdReached);
        Assert.Equal(3, db.PerformanceCycleAuditEvents.Count(e => e.Action == PerformanceCycleAuditAction.FeedbackResponseLocked));
    }

    private static FeedbackResponseContent CreateSubmittedContent(Guid tenantId, Guid cycleId, Guid subjectId, DateTime submittedAt)
    {
        var content = FeedbackResponseContent.Create(tenantId, cycleId, subjectId, CampaignWorkItemType.PeerFeedback, Guid.NewGuid(),
            [new FeedbackPromptAnswerInput(Guid.NewGuid(), "Q1", 1, "Answer", true)]);
        content.Submit(submittedAt);
        return content;
    }

    private static PerformanceCycle CreateActiveCycle(Guid tenantId, DateTime now)
    {
        var cycle = TestCycles.Create(tenantId, "FY", PerformanceCycleType.Annual, now.AddDays(-10), now.AddDays(10));
        cycle.ConfigureGovernance(Guid.NewGuid(), false, 3, CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
        cycle.BeginAssignmentPreparation(1, now.AddDays(-1));
        cycle.MarkReadyToLaunch(1, 0, true, now.AddHours(-12));
        cycle.Activate(now);
        return cycle;
    }
}

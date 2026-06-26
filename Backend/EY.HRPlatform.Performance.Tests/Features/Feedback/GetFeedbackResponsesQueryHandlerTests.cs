using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Queries.GetFeedbackResponses;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Feedback;

public sealed class GetFeedbackResponsesQueryHandlerTests
{
    [Fact]
    public async Task GetByCycleSubjectType_ThresholdMet_ReturnsResponses()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateCycleWithThreshold(tenantId, minimumResponses: 3);
        var content1 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var content2 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var content3 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        db.AddRange(cycle, content1, content2, content3);
        await db.SaveChangesAsync();
        var handler = new GetFeedbackResponsesQueryHandler(db);

        var result = await handler.Handle(new GetFeedbackResponsesQuery(cycle.Id, subjectId, CampaignWorkItemType.PeerFeedback), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.Responses.Count);
        Assert.False(result.Value.IsSuppressed);
    }

    [Fact]
    public async Task GetByCycleSubjectType_NoResponses_ReturnsSuppressedEmpty()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateCycleWithThreshold(tenantId, minimumResponses: 3);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        var handler = new GetFeedbackResponsesQueryHandler(db);

        var result = await handler.Handle(new GetFeedbackResponsesQuery(cycle.Id, subjectId, CampaignWorkItemType.PeerFeedback), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Responses);
        Assert.True(result.Value.IsSuppressed);
    }

    [Fact]
    public async Task GetByCycleSubjectType_BelowThreshold_ReturnsSuppressed()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateCycleWithThreshold(tenantId, minimumResponses: 3);
        var content = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        db.AddRange(cycle, content);
        await db.SaveChangesAsync();
        var handler = new GetFeedbackResponsesQueryHandler(db);

        var result = await handler.Handle(new GetFeedbackResponsesQuery(cycle.Id, subjectId, CampaignWorkItemType.PeerFeedback), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Responses);
        Assert.True(result.Value.IsSuppressed);
        Assert.Equal(0, result.Value.CurrentCount);
        Assert.Equal(3, result.Value.MinimumRequired);
    }

    [Fact]
    public async Task GetByCycleSubjectType_LockedResponsesAboveThreshold_ReturnsResponses()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateCycleWithThreshold(tenantId, minimumResponses: 3);
        var content1 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var content2 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var content3 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        content1.Lock(DateTime.UtcNow);
        content2.Lock(DateTime.UtcNow);
        content3.Lock(DateTime.UtcNow);
        db.AddRange(cycle, content1, content2, content3);
        await db.SaveChangesAsync();
        var handler = new GetFeedbackResponsesQueryHandler(db);

        var result = await handler.Handle(new GetFeedbackResponsesQuery(cycle.Id, subjectId, CampaignWorkItemType.PeerFeedback), default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.IsSuppressed);
        Assert.Equal(3, result.Value.Responses.Count);
    }

    [Fact]
    public async Task GetByCycleSubjectType_InvalidatedResponses_DoNotCountTowardThreshold()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateCycleWithThreshold(tenantId, minimumResponses: 3);
        var content1 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var content2 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var content3 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        content3.Invalidate("Duplicate");
        db.AddRange(cycle, content1, content2, content3);
        await db.SaveChangesAsync();
        var handler = new GetFeedbackResponsesQueryHandler(db);

        var result = await handler.Handle(new GetFeedbackResponsesQuery(cycle.Id, subjectId, CampaignWorkItemType.PeerFeedback), default);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.IsSuppressed);
        Assert.Empty(result.Value.Responses);
        Assert.Equal(0, result.Value.CurrentCount);
    }

    [Fact]
    public async Task GetByCycleSubjectType_MultipleSubjectResponses_OnlyReturnsMatchingSubject()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var otherSubjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateCycleWithThreshold(tenantId, minimumResponses: 3);
        var myContent1 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var myContent2 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var myContent3 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var otherContent = CreateSubmittedContent(tenantId, cycle.Id, otherSubjectId);
        db.AddRange(cycle, myContent1, myContent2, myContent3, otherContent);
        await db.SaveChangesAsync();
        var handler = new GetFeedbackResponsesQueryHandler(db);

        var result = await handler.Handle(new GetFeedbackResponsesQuery(cycle.Id, subjectId, CampaignWorkItemType.PeerFeedback), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.Responses.Count);
    }

    [Fact]
    public async Task GetByCycleSubjectType_DtoMapping_VerifyResponseItemDtoFields()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateCycleWithThreshold(tenantId, minimumResponses: 3);
        var content1 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var content2 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var content3 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        db.AddRange(cycle, content1, content2, content3);
        await db.SaveChangesAsync();
        var handler = new GetFeedbackResponsesQueryHandler(db);

        var result = await handler.Handle(new GetFeedbackResponsesQuery(cycle.Id, subjectId, CampaignWorkItemType.PeerFeedback), default);

        Assert.True(result.IsSuccess);
        var dto = Assert.Single(result.Value.Responses, r => r.Id == content1.Id);
        Assert.True(dto.SubmittedAt > DateTime.MinValue);
    }

    [Fact]
    public async Task GetByCycleSubjectType_ReturnsLatestGeneralCommentForEachResponse()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateCycleWithThreshold(tenantId, minimumResponses: 3);
        var content1 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var content2 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);
        var content3 = CreateSubmittedContent(tenantId, cycle.Id, subjectId);

        var versions =
            new[]
            {
                FeedbackResponseVersion.Create(tenantId, content1.Id, 1, "[]", "First draft", authorId),
                FeedbackResponseVersion.Create(tenantId, content1.Id, 2, "[]", "Latest comment", authorId),
                FeedbackResponseVersion.Create(tenantId, content2.Id, 1, "[]", null, authorId),
                FeedbackResponseVersion.Create(tenantId, content3.Id, 1, "[]", "Third comment", authorId)
            };

        db.AddRange(cycle, content1, content2, content3);
        db.FeedbackResponseVersions.AddRange(versions);
        await db.SaveChangesAsync();

        var handler = new GetFeedbackResponsesQueryHandler(db);

        var result = await handler.Handle(new GetFeedbackResponsesQuery(cycle.Id, subjectId, CampaignWorkItemType.PeerFeedback), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Latest comment", result.Value.Responses.Single(r => r.Id == content1.Id).GeneralComment);
        Assert.Null(result.Value.Responses.Single(r => r.Id == content2.Id).GeneralComment);
        Assert.Equal("Third comment", result.Value.Responses.Single(r => r.Id == content3.Id).GeneralComment);
    }

    private static PerformanceCycle CreateCycleWithThreshold(Guid tenantId, int minimumResponses)
    {
        var cycle = PerformanceCycle.Create(tenantId, "FY", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-10), DateTime.UtcNow.AddDays(10));
        cycle.ConfigureGovernance(Guid.NewGuid(), false, minimumResponses,
            CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
        return cycle;
    }

    private static FeedbackResponseContent CreateSubmittedContent(Guid tenantId, Guid cycleId, Guid subjectId)
    {
        var content = FeedbackResponseContent.Create(tenantId, cycleId, subjectId, CampaignWorkItemType.PeerFeedback, Guid.NewGuid(),
            [new FeedbackPromptAnswerInput(Guid.NewGuid(), "Q1", 1, "Answer", true)]);
        content.Submit(DateTime.UtcNow);
        return content;
    }
}

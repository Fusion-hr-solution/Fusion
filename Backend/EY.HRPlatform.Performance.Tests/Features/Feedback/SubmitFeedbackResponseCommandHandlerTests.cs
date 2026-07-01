using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Commands.SubmitFeedbackResponse;
using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Feedback;

public sealed class SubmitFeedbackResponseCommandHandlerTests
{
    [Fact]
    public async Task Submit_Success_ValidWorkItemAllRequiredPromptsFilled_CreatesContentAndMapping()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, now);
        var template = CreatePeerTemplate(tenantId, cycle.Id);
        var workItem = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, reviewerId, CampaignWorkItemType.PeerFeedback, now.AddDays(5));
        db.AddRange(cycle, template, workItem);
        await db.SaveChangesAsync();
        var handler = new SubmitFeedbackResponseCommandHandler(db, new StubCurrentUserContext { EmployeeId = reviewerId });

        var prompt = template.Prompts.First();
        var result = await handler.Handle(new SubmitFeedbackResponseCommand(
            workItem.Id,
            [new FeedbackAnswerInput(prompt.Id, "Great teamwork")],
            null), default);

        Assert.True(result.IsSuccess);
        Assert.NotEqual(Guid.Empty, result.Value);
        var content = Assert.Single(db.FeedbackResponseContents);
        Assert.Equal(FeedbackResponseStatus.Submitted, content.Status);
        var mapping = Assert.Single(db.FeedbackIdentityMappings);
        Assert.Equal(reviewerId, mapping.ReviewerEmployeeId);
    }

    [Fact]
    public async Task Submit_WorkItemNotFound_InvalidId_ReturnsNotFound()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var handler = new SubmitFeedbackResponseCommandHandler(db, new StubCurrentUserContext { EmployeeId = reviewerId });

        var result = await handler.Handle(new SubmitFeedbackResponseCommand(
            Guid.NewGuid(), [new FeedbackAnswerInput(Guid.NewGuid(), "Answer")], null), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Submit_NotAssigned_WorkItemAssignedToDifferentEmployee_ReturnsForbidden()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, now);
        var template = CreatePeerTemplate(tenantId, cycle.Id);
        var workItem = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, otherId, CampaignWorkItemType.PeerFeedback, now.AddDays(5));
        db.AddRange(cycle, template, workItem);
        await db.SaveChangesAsync();
        var handler = new SubmitFeedbackResponseCommandHandler(db, new StubCurrentUserContext { EmployeeId = reviewerId });

        var result = await handler.Handle(new SubmitFeedbackResponseCommand(
            workItem.Id, [new FeedbackAnswerInput(Guid.NewGuid(), "Answer")], null), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotAssigned", result.Error.Code);
    }

    [Fact]
    public async Task Submit_SelfFeedback_ReviewerEqualsSubject_ReturnsValidationError()
    {
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, now);
        var template = CreatePeerTemplate(tenantId, cycle.Id);
        var workItem = CampaignWorkItem.Create(tenantId, cycle.Id, employeeId, employeeId, CampaignWorkItemType.PeerFeedback, now.AddDays(5));
        db.AddRange(cycle, template, workItem);
        await db.SaveChangesAsync();
        var handler = new SubmitFeedbackResponseCommandHandler(db, new StubCurrentUserContext { EmployeeId = employeeId });

        var result = await handler.Handle(new SubmitFeedbackResponseCommand(
            workItem.Id, [new FeedbackAnswerInput(Guid.NewGuid(), "Answer")], null), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("SelfFeedback", result.Error.Code);
    }

    [Fact]
    public async Task Submit_AlreadySubmitted_ResponseExists_ReturnsConflict()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, now);
        var template = CreatePeerTemplate(tenantId, cycle.Id);
        var workItem = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, reviewerId, CampaignWorkItemType.PeerFeedback, now.AddDays(5));
        var prompt = template.Prompts.First();
        var existingContent = FeedbackResponseContent.Create(tenantId, cycle.Id, subjectId, CampaignWorkItemType.PeerFeedback, template.Id,
            [new FeedbackPromptAnswerInput(prompt.Id, prompt.PromptText, prompt.Version, "Existing answer", prompt.IsRequired)]);
        existingContent.Submit(now);
        db.AddRange(cycle, template, workItem, existingContent);
        await db.SaveChangesAsync();
        var handler = new SubmitFeedbackResponseCommandHandler(db, new StubCurrentUserContext { EmployeeId = reviewerId });

        var result = await handler.Handle(new SubmitFeedbackResponseCommand(
            workItem.Id, [new FeedbackAnswerInput(prompt.Id, "New answer")], null), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("AlreadySubmitted", result.Error.Code);
    }

    [Fact]
    public async Task Submit_MissingRequiredPrompts_RequiredPromptNotAnswered_ReturnsValidation()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, now);
        var template = CreatePeerTemplate(tenantId, cycle.Id);
        var workItem = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, reviewerId, CampaignWorkItemType.PeerFeedback, now.AddDays(5));
        db.AddRange(cycle, template, workItem);
        await db.SaveChangesAsync();
        var handler = new SubmitFeedbackResponseCommandHandler(db, new StubCurrentUserContext { EmployeeId = reviewerId });

        // Submit without the required prompt
        var result = await handler.Handle(new SubmitFeedbackResponseCommand(
            workItem.Id, [], null), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("MissingRequiredPrompts", result.Error.Code);
    }

    [Fact]
    public async Task Submit_TemplateMissing_NoFrozenTemplate_ReturnsConflict()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, now);
        var workItem = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, reviewerId, CampaignWorkItemType.PeerFeedback, now.AddDays(5));
        db.AddRange(cycle, workItem); // No template
        await db.SaveChangesAsync();
        var handler = new SubmitFeedbackResponseCommandHandler(db, new StubCurrentUserContext { EmployeeId = reviewerId });

        var result = await handler.Handle(new SubmitFeedbackResponseCommand(
            workItem.Id, [new FeedbackAnswerInput(Guid.NewGuid(), "Answer")], null), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("TemplateMissing", result.Error.Code);
    }

    [Fact]
    public async Task Submit_AuditEmitted_VerifyFeedbackResponseSubmittedAuditEvent()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = CreateActiveCycle(tenantId, now);
        var template = CreatePeerTemplate(tenantId, cycle.Id);
        var workItem = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, reviewerId, CampaignWorkItemType.PeerFeedback, now.AddDays(5));
        db.AddRange(cycle, template, workItem);
        await db.SaveChangesAsync();
        var currentUser = new StubCurrentUserContext { EmployeeId = reviewerId };
        var handler = new SubmitFeedbackResponseCommandHandler(db, currentUser);

        var prompt = template.Prompts.First();
        await handler.Handle(new SubmitFeedbackResponseCommand(
            workItem.Id, [new FeedbackAnswerInput(prompt.Id, "Answer")], null), default);

        var auditEvent = Assert.Single(db.PerformanceCycleAuditEvents,
            e => e.Action == PerformanceCycleAuditAction.FeedbackResponseSubmitted);
        // Audit stores currentUser.UserId (not EmployeeId)
        Assert.Equal(currentUser.UserId, auditEvent.ActorUserId);
    }

    private static PerformanceCycle CreateActiveCycle(Guid tenantId, DateTime now)
    {
        var cycle = PerformanceCycle.Create(tenantId, "FY review", PerformanceCycleType.Annual, now.AddDays(-2), now.AddDays(10));
        cycle.ConfigureGovernance(Guid.NewGuid(), false, 3, CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
        cycle.BeginAssignmentPreparation(1, now.AddDays(-1));
        cycle.MarkReadyToLaunch(1, 0, true, now.AddHours(-12));
        cycle.Activate(now);
        return cycle;
    }

    private static FeedbackTemplateSnapshot CreatePeerTemplate(Guid tenantId, Guid cycleId)
        => FeedbackTemplateSnapshot.Create(tenantId, cycleId, FeedbackResponseType.Peer, "Peer Template",
            [new FeedbackPromptDefinition("What are strengths?", "Strengths", true, 1),
             new FeedbackPromptDefinition("Development areas?", null, false, 2)], DateTime.UtcNow);
}

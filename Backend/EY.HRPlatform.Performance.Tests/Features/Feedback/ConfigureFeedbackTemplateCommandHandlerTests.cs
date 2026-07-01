using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Commands.ConfigureFeedbackTemplate;
using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Feedback;

public sealed class ConfigureFeedbackTemplateCommandHandlerTests
{
    [Fact]
    public async Task CreateTemplate_Success_ValidCycleDraftStatus_CreatesSnapshotWithPrompts()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = PerformanceCycle.Create(tenantId, "FY review", PerformanceCycleType.Annual, now.AddDays(-2), now.AddDays(10));
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        var handler = new ConfigureFeedbackTemplateCommandHandler(db, new StubCurrentUserContext());

        var result = await handler.Handle(new ConfigureFeedbackTemplateCommand(
            cycle.Id, "PeerFeedback", "Peer Feedback Template",
            [new FeedbackPromptDefinitionInput("What are strengths?", "Strengths", true, 1),
             new FeedbackPromptDefinitionInput("Development areas?", null, false, 2)]), default);

        Assert.True(result.IsSuccess);
        var template = Assert.Single(db.FeedbackTemplateSnapshots);
        Assert.Equal("Peer Feedback Template", template.Name);
        Assert.Equal(FeedbackResponseType.Peer, template.FeedbackType);
        Assert.Equal(2, template.Prompts.Count);
    }

    [Fact]
    public async Task CreateTemplate_CycleNotFound_InvalidCycleId_ReturnsNotFound()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var handler = new ConfigureFeedbackTemplateCommandHandler(db, new StubCurrentUserContext());

        var result = await handler.Handle(new ConfigureFeedbackTemplateCommand(
            Guid.NewGuid(), "PeerFeedback", "Template",
            [new FeedbackPromptDefinitionInput("Q1", null, true, 1)]), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task CreateTemplate_CycleNotDraft_ActiveCycle_ReturnsForbidden()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = PerformanceCycle.Create(tenantId, "FY review", PerformanceCycleType.Annual, now.AddDays(-2), now.AddDays(10));
        cycle.ConfigureGovernance(Guid.NewGuid(), false, 3, CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
        cycle.BeginAssignmentPreparation(1, now.AddDays(-1));
        cycle.MarkReadyToLaunch(1, 0, true, now.AddHours(-12));
        cycle.Activate(now);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        var handler = new ConfigureFeedbackTemplateCommandHandler(db, new StubCurrentUserContext());

        var result = await handler.Handle(new ConfigureFeedbackTemplateCommand(
            cycle.Id, "PeerFeedback", "Template",
            [new FeedbackPromptDefinitionInput("Q1", null, true, 1)]), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("TemplateFrozen", result.Error.Code);
    }

    [Fact]
    public async Task CreateTemplate_DuplicateType_AlreadyConfigured_ReturnsConflict()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = PerformanceCycle.Create(tenantId, "FY review", PerformanceCycleType.Annual, now.AddDays(-2), now.AddDays(10));
        var template = FeedbackTemplateSnapshot.Create(tenantId, cycle.Id, FeedbackResponseType.Peer, "Existing",
            [new FeedbackPromptDefinition("Q1", null, true, 1)], now);
        db.AddRange(cycle, template);
        await db.SaveChangesAsync();
        var handler = new ConfigureFeedbackTemplateCommandHandler(db, new StubCurrentUserContext());

        var result = await handler.Handle(new ConfigureFeedbackTemplateCommand(
            cycle.Id, "PeerFeedback", "Duplicate",
            [new FeedbackPromptDefinitionInput("Q1", null, true, 1)]), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("TemplateAlreadyExists", result.Error.Code);
    }

    [Fact]
    public async Task CreateTemplate_InvalidFeedbackType_UnknownType_ReturnsValidation()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = PerformanceCycle.Create(tenantId, "FY review", PerformanceCycleType.Annual, now.AddDays(-2), now.AddDays(10));
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        var handler = new ConfigureFeedbackTemplateCommandHandler(db, new StubCurrentUserContext());

        var result = await handler.Handle(new ConfigureFeedbackTemplateCommand(
            cycle.Id, "InvalidType", "Template",
            [new FeedbackPromptDefinitionInput("Q1", null, true, 1)]), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("InvalidFeedbackType", result.Error.Code);
    }
}

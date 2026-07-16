using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Commands.InvalidateFeedbackResponse;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.Performance.Tests.Features.Feedback;

public sealed class InvalidateFeedbackResponseCommandHandlerTests
{
    [Fact]
    public async Task Invalidate_Success_ValidAdminSubmittedResponse_IsInvalidated()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var content = CreateSubmittedContent(tenantId);
        db.FeedbackResponseContents.Add(content);
        await db.SaveChangesAsync();
        var accessPolicy = new FakeAccessPolicy(canManage: true);
        var handler = new InvalidateFeedbackResponseCommandHandler(
            db,
            new StubCurrentUserContext { EmployeeId = Guid.NewGuid() },
            accessPolicy,
            CreateHttpContextAccessor());

        var result = await handler.Handle(new InvalidateFeedbackResponseCommand(content.Id, "Spam content"), default);

        Assert.True(result.IsSuccess);
        Assert.True(content.IsInvalidated);
        Assert.Equal("Spam content", content.InvalidationReason);
    }

    [Fact]
    public async Task Invalidate_NoPermission_NonAdmin_ReturnsForbidden()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var content = CreateSubmittedContent(tenantId);
        db.FeedbackResponseContents.Add(content);
        await db.SaveChangesAsync();
        var accessPolicy = new FakeAccessPolicy(canManage: false);
        var handler = new InvalidateFeedbackResponseCommandHandler(
            db,
            new StubCurrentUserContext { EmployeeId = Guid.NewGuid() },
            accessPolicy,
            CreateHttpContextAccessor());

        var result = await handler.Handle(new InvalidateFeedbackResponseCommand(content.Id, "Reason"), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("InsufficientPermissions", result.Error.Code);
    }

    [Fact]
    public async Task Invalidate_NoReason_EmptyReason_ReturnsValidation()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var content = CreateSubmittedContent(tenantId);
        db.FeedbackResponseContents.Add(content);
        await db.SaveChangesAsync();
        var accessPolicy = new FakeAccessPolicy(canManage: true);
        var handler = new InvalidateFeedbackResponseCommandHandler(
            db,
            new StubCurrentUserContext { EmployeeId = Guid.NewGuid() },
            accessPolicy,
            CreateHttpContextAccessor());

        var result = await handler.Handle(new InvalidateFeedbackResponseCommand(content.Id, ""), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("MissingReason", result.Error.Code);
    }

    [Fact]
    public async Task Invalidate_AuditEmitted_VerifyFeedbackResponseInvalidatedAuditEvent()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var content = CreateSubmittedContent(tenantId);
        db.FeedbackResponseContents.Add(content);
        await db.SaveChangesAsync();
        var accessPolicy = new FakeAccessPolicy(canManage: true);
        var handler = new InvalidateFeedbackResponseCommandHandler(
            db,
            new StubCurrentUserContext { EmployeeId = Guid.NewGuid() },
            accessPolicy,
            CreateHttpContextAccessor());

        await handler.Handle(new InvalidateFeedbackResponseCommand(content.Id, "Spam"), default);

        var auditEvent = Assert.Single(db.PerformanceCycleAuditEvents,
            e => e.Action == PerformanceCycleAuditAction.FeedbackResponseInvalidated);
        Assert.NotNull(auditEvent);
    }

    private static FeedbackResponseContent CreateSubmittedContent(Guid tenantId)
    {
        var content = FeedbackResponseContent.Create(tenantId, Guid.NewGuid(), Guid.NewGuid(), CampaignWorkItemType.PeerFeedback, Guid.NewGuid(),
            [new FeedbackPromptAnswerInput(Guid.NewGuid(), "Q1", 1, "Answer", true)]);
        content.Submit(DateTime.UtcNow);
        return content;
    }

    private static IHttpContextAccessor CreateHttpContextAccessor()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity(
                [new System.Security.Claims.Claim("sub", "test-user")],
                "TestAuth"));
        return new HttpContextAccessor { HttpContext = httpContext };
    }

    private sealed class FakeAccessPolicy(bool canManage) : IPerformanceAccessPolicyService
    {
        public bool CanViewCycles(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanManageCycles(System.Security.Claims.ClaimsPrincipal user) => canManage;
        public bool CanOperateCycles(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanViewStrategicObjectives(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanManageStrategicObjectives(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanPublishStrategicObjectives(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanAccessConfidentialFeedbackIdentity(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanViewFeedbackThresholdDetails(System.Security.Claims.ClaimsPrincipal user) => false;
    }
}

using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Commands.ResolveFeedbackIdentity;
using EY.HRPlatform.Performance.Features.Feedback.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.Performance.Tests.Features.Feedback;

public sealed class ResolveFeedbackIdentityCommandHandlerTests
{
    [Fact]
    public async Task Resolve_Success_ReviewersResponse_ContainsReviewerId()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var content = CreateSubmittedContent(tenantId, Guid.NewGuid(), subjectId);
        var mapping = FeedbackIdentityMapping.Create(tenantId, content.Id, Guid.NewGuid(), reviewerId);
        db.AddRange(content, mapping);
        await db.SaveChangesAsync();
        var accessPolicy = new FakeAccessPolicy(canAccessConfidential: true);
        var httpContextAccessor = CreateHttpContextAccessor();
        var handler = new ResolveFeedbackIdentityCommandHandler(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() }, accessPolicy, httpContextAccessor);

        var result = await handler.Handle(new ResolveFeedbackIdentityCommand(content.Id, "Audit review"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(reviewerId, result.Value.ReviewerEmployeeId);
    }

    [Fact]
    public async Task Resolve_NotFound_InvalidResponseId_ReturnsNotFound()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var accessPolicy = new FakeAccessPolicy(canAccessConfidential: true);
        var httpContextAccessor = CreateHttpContextAccessor();
        var handler = new ResolveFeedbackIdentityCommandHandler(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() }, accessPolicy, httpContextAccessor);

        var result = await handler.Handle(new ResolveFeedbackIdentityCommand(Guid.NewGuid(), "Audit review"), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Resolve_NoPermission_NonConfidentialAdmin_ReturnsForbidden()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var content = CreateSubmittedContent(tenantId, Guid.NewGuid(), Guid.NewGuid());
        db.FeedbackResponseContents.Add(content);
        await db.SaveChangesAsync();
        var accessPolicy = new FakeAccessPolicy(canAccessConfidential: false);
        var httpContextAccessor = CreateHttpContextAccessor();
        var handler = new ResolveFeedbackIdentityCommandHandler(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() }, accessPolicy, httpContextAccessor);

        var result = await handler.Handle(new ResolveFeedbackIdentityCommand(content.Id, "Audit review"), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("IdentityAccessDenied", result.Error.Code);
    }

    [Fact]
    public async Task Resolve_NoIdentityMapping_AnonymousResponse_ReturnsNotFound()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var content = CreateSubmittedContent(tenantId, Guid.NewGuid(), Guid.NewGuid());
        db.FeedbackResponseContents.Add(content); // No mapping
        await db.SaveChangesAsync();
        var accessPolicy = new FakeAccessPolicy(canAccessConfidential: true);
        var httpContextAccessor = CreateHttpContextAccessor();
        var handler = new ResolveFeedbackIdentityCommandHandler(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() }, accessPolicy, httpContextAccessor);

        var result = await handler.Handle(new ResolveFeedbackIdentityCommand(content.Id, "Audit review"), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Resolve_EmptyReason_ReturnsValidation()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var content = CreateSubmittedContent(tenantId, Guid.NewGuid(), subjectId);
        var mapping = FeedbackIdentityMapping.Create(tenantId, content.Id, Guid.NewGuid(), reviewerId);
        db.AddRange(content, mapping);
        await db.SaveChangesAsync();
        var accessPolicy = new FakeAccessPolicy(canAccessConfidential: true);
        var httpContextAccessor = CreateHttpContextAccessor();
        var handler = new ResolveFeedbackIdentityCommandHandler(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() }, accessPolicy, httpContextAccessor);

        var result = await handler.Handle(new ResolveFeedbackIdentityCommand(content.Id, " "), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("MissingReason", result.Error.Code);
    }

    [Fact]
    public async Task Resolve_AuditEvent_UsesResponseCycleId()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var cycleId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var content = CreateSubmittedContent(tenantId, cycleId, subjectId);
        var mapping = FeedbackIdentityMapping.Create(tenantId, content.Id, Guid.NewGuid(), reviewerId);
        db.AddRange(content, mapping);
        await db.SaveChangesAsync();
        var currentUser = new StubCurrentUserContext { EmployeeId = Guid.NewGuid() };
        var accessPolicy = new FakeAccessPolicy(canAccessConfidential: true);
        var httpContextAccessor = CreateHttpContextAccessor();
        var handler = new ResolveFeedbackIdentityCommandHandler(db, currentUser, accessPolicy, httpContextAccessor);

        var result = await handler.Handle(new ResolveFeedbackIdentityCommand(content.Id, "Compliance review"), default);

        Assert.True(result.IsSuccess);
        var auditEvent = Assert.Single(db.PerformanceCycleAuditEvents,
            e => e.Action == PerformanceCycleAuditAction.FeedbackIdentityAccessed);
        Assert.Equal(cycleId, auditEvent.CycleId);
    }

    private static FeedbackResponseContent CreateSubmittedContent(Guid tenantId, Guid cycleId, Guid subjectId)
    {
        var content = FeedbackResponseContent.Create(tenantId, cycleId, subjectId, CampaignWorkItemType.PeerFeedback, Guid.NewGuid(),
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

    private sealed class FakeAccessPolicy(bool canAccessConfidential) : IPerformanceAccessPolicyService
    {
        public bool CanViewCycles(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanManageCycles(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanOperateCycles(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanViewObjectiveLibrary(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanManageObjectiveLibrary(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanViewStrategicObjectives(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanManageStrategicObjectives(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanPublishStrategicObjectives(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanViewCollectiveObjectives(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanApproveCollectiveObjectives(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanCorrectObjectiveProgress(System.Security.Claims.ClaimsPrincipal user) => false;
        public bool CanAccessConfidentialFeedbackIdentity(System.Security.Claims.ClaimsPrincipal user) => canAccessConfidential;
        public bool CanViewFeedbackThresholdDetails(System.Security.Claims.ClaimsPrincipal user) => false;
    }
}

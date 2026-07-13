using System.Net;
using EY.HRPlatform.Interview.Tests.TestHelpers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace EY.HRPlatform.Interview.Tests.Features.Integration;

/// <summary>
/// Regression guard for a CRITICAL authorization hole: the API registered AddAuthorization() with no
/// FallbackPolicy, so every endpoint lacking an explicit [Authorize] was ANONYMOUS. That exposed the
/// whole authoring/admin surface — most severely GET /questions, whose DTO carries TestCases and the
/// candidate-hidden FrontendTestFiles (i.e. the grading answer keys), plus candidate PII, GDPR
/// privacy actions and destructive deletes.
///
/// These tests assert the two halves of the contract:
///   1. protected routes reject unauthenticated callers, and
///   2. the token-gated candidate surface is still reachable anonymously.
/// </summary>
public class AuthorizationPolicyIntegrationTests
{
    private static readonly WebApplicationFactoryClientOptions ClientOptions = new() { AllowAutoRedirect = false };

    public static TheoryData<string, string> ProtectedRoutes() => new()
    {
        // The worst one: leaks every question's TestCases + hidden FrontendTestFiles (answer keys).
        { "GET", "/api/interview/questions?page=1&pageSize=10" },
        { "GET", "/api/interview/tests" },
        // Candidate PII.
        { "GET", "/api/interview/candidates/invitations/pending" },
        { "GET", "/api/interview/candidates/management/overview" },
        { "GET", "/api/interview/candidates/management/attempt-settings" },
        { "GET", "/api/interview/candidates/management/retention" },
        // Human-review queue (already had [Authorize] — pinned so it can't regress).
        { "GET", "/api/interview/grading/reviews" },
    };

    [Theory]
    [MemberData(nameof(ProtectedRoutes))]
    public async Task ProtectedRoute_WithoutToken_IsRejected(string method, string route)
    {
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateClient(ClientOptions);

        var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), route));

        Assert.True(
            response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden,
            $"{method} {route} must require authentication but returned {(int)response.StatusCode} {response.StatusCode}.");
    }

    [Theory]
    [MemberData(nameof(ProtectedRoutes))]
    public async Task ProtectedRoute_WithToken_IsNotRejectedByAuth(string method, string route)
    {
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateAuthenticatedClient(ClientOptions);

        var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), route));

        // The route may 400/404 on its own merits — it just must not be blocked by authentication.
        Assert.False(
            response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden,
            $"{method} {route} rejected a valid bearer token with {(int)response.StatusCode} {response.StatusCode}.");
    }

    [Fact]
    public async Task CandidateSurface_StaysAnonymous_UnderTheFallbackPolicy()
    {
        // The candidate flow is gated by its invitation token, not a JWT — [AllowAnonymous] must keep
        // working, otherwise the fallback policy would lock every candidate out of their assessment.
        await using var factory = new InterviewApiFactory();
        var client = factory.CreateClient(ClientOptions);

        var response = await client.GetAsync("/api/interview/candidate-access/validate?token=not-a-real-token-0123456789");

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }
}

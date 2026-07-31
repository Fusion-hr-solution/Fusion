using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.Performance.Tests.Infrastructure.Workforce;

/// <summary>
/// Verifies that BearerTokenForwardingHandler copies the inbound caller's bearer token onto
/// every outbound request, and that CoreWorkforceClient correctly parses and throws on
/// ApiResponse payloads.
/// </summary>
public sealed class CoreWorkforceClientTests
{
    // -----------------------------------------------------------------------
    // Recording stub inner handler
    // -----------------------------------------------------------------------

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }
        public HttpResponseMessage Response { get; set; } = new(HttpStatusCode.OK);

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            // Clone the Authorization header value so callers can inspect it after the
            // pipeline disposes the original request.
            var auth = request.Headers.Authorization?.ToString();
            CapturedAuthorization = auth;
            return Task.FromResult(Response);
        }

        public string? CapturedAuthorization { get; private set; }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private static (CoreWorkforceClient client, RecordingHandler recorder) BuildPipeline(
        string? authorizationHeaderValue,
        HttpResponseMessage response)
    {
        var recorder = new RecordingHandler { Response = response };

        // Build a DefaultHttpContext with the supplied Authorization header.
        var httpContext = new DefaultHttpContext();
        if (authorizationHeaderValue is not null)
            httpContext.Request.Headers["Authorization"] = authorizationHeaderValue;

        // Compose: BearerTokenForwardingHandler → RecordingHandler (inner)
        var forwarder = new BearerTokenForwardingHandler(new FakeHttpContextAccessor(httpContext))
        {
            InnerHandler = recorder,
        };

        var httpClient = new HttpClient(forwarder) { BaseAddress = new Uri("http://core.local/") };
        var client = new CoreWorkforceClient(httpClient, new NoOpInternalServiceRequestSigner());
        return (client, recorder);
    }

    private sealed class FakeHttpContextAccessor(HttpContext context) : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; } = context;
    }

    private sealed class NoOpInternalServiceRequestSigner : IInternalServiceRequestSigner
    {
        public Task SignAsync(HttpRequestMessage request, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private static HttpResponseMessage OkJson<T>(T value)
    {
        var json = JsonSerializer.Serialize(value);
        var response = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json"),
        };
        return response;
    }

    // -----------------------------------------------------------------------
    // Test A — forwarding
    // -----------------------------------------------------------------------

    [Fact]
    public async Task ResolveEmployees_ForwardsCallerBearerToken_ToCore()
    {
        var employeeId = Guid.NewGuid();
        var summaries = new List<CoreEmployeeSummary>
        {
            new(employeeId, "E-abc123", "Alice Smith", "Alice", "alice@test.local", "Engineer", true, null, null),
        };
        var response = OkJson(ApiResponse<List<CoreEmployeeSummary>>.Success(summaries));

        var (client, recorder) = BuildPipeline("Bearer test-token", response);

        await client.ResolveEmployeesAsync([employeeId], CancellationToken.None);

        Assert.NotNull(recorder.CapturedAuthorization);
        Assert.Equal("Bearer test-token", recorder.CapturedAuthorization);
    }

    // -----------------------------------------------------------------------
    // Test B — no fabrication
    // -----------------------------------------------------------------------

    [Fact]
    public async Task ResolveEmployees_DoesNotFabricateAuthorizationHeader_WhenCallerHasNone()
    {
        var employeeId = Guid.NewGuid();
        var summaries = new List<CoreEmployeeSummary>
        {
            new(employeeId, "E-abc123", "Bob Jones", "Bob", "bob@test.local", "Analyst", true, null, null),
        };
        var response = OkJson(ApiResponse<List<CoreEmployeeSummary>>.Success(summaries));

        // No Authorization header provided.
        var (client, recorder) = BuildPipeline(null, response);

        await client.ResolveEmployeesAsync([employeeId], CancellationToken.None);

        Assert.Null(recorder.CapturedAuthorization);
    }

    // -----------------------------------------------------------------------
    // Test C — contract parse and non-success throw
    // -----------------------------------------------------------------------

    [Fact]
    public async Task ResolveEmployees_ParsesApiResponse_AndThrowsOnNonSuccessStatus()
    {
        var id1 = Guid.NewGuid();
        var id2 = Guid.NewGuid();
        var summaries = new List<CoreEmployeeSummary>
        {
            new(id1, "E-aaa111", "Carol White", "Carol", "carol@test.local", "Manager", true, null, null),
            new(id2, "E-bbb222", "Dave Brown", "Dave", "dave@test.local", "Engineer", true, null, null),
        };

        // --- Part 1: successful 200 response parses correctly ---
        var okResponse = OkJson(ApiResponse<List<CoreEmployeeSummary>>.Success(summaries));
        var (client, _) = BuildPipeline("Bearer test-token", okResponse);

        var result = await client.ResolveEmployeesAsync([id1, id2], CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, s => s.EmployeeId == id1);
        Assert.Contains(result, s => s.EmployeeId == id2);

        // --- Part 2: non-success HTTP status throws InvalidOperationException ---
        var errorResponse = new HttpResponseMessage(HttpStatusCode.InternalServerError)
        {
            Content = new StringContent("Internal Server Error"),
        };
        var (clientForError, _) = BuildPipeline("Bearer test-token", errorResponse);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => clientForError.ResolveEmployeesAsync([id1], CancellationToken.None));
    }

    [Fact]
    public async Task ResolveEmployeesAsOf_UsesInternalSnapshotEndpoint_AndParsesRawJson()
    {
        var employeeId = Guid.NewGuid();
        var asOf = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);
        var summaries = new List<CoreEmployeeSummary>
        {
            new(employeeId, "E-abc123", "Alice Smith", "Alice", "alice@test.local", "Engineer", true, null, null),
        };
        var response = OkJson(summaries);

        var (client, recorder) = BuildPipeline("Bearer test-token", response);

        var result = await client.ResolveEmployeesAsOfAsync(asOf, [employeeId], CancellationToken.None);

        Assert.Single(result);
        Assert.NotNull(recorder.LastRequest);
        Assert.Equal("/internal/corehr/workforce/snapshots/resolve", recorder.LastRequest!.RequestUri!.AbsolutePath);
    }
}

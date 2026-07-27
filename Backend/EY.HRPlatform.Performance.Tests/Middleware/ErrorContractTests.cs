using System.Text.Json;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Features.Shared;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Middleware;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Performance.Tests.Middleware;

/// <summary>
/// The exception-to-status classification rules (design D7 and D8), and the guarantee that every
/// failure source emits the same problem shape carrying a code and a correlation id.
/// </summary>
public sealed class ErrorContractTests
{
    private sealed record Problem(int Status, string Code, string Detail, string CorrelationId);

    /// <summary>Runs the middleware over a handler that throws, and reads back the problem written.</summary>
    private static async Task<Problem> CaptureAsync(Exception thrown)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/performance/cycles";
        context.Request.Headers["X-Correlation-Id"] = "corr-123";

        var body = new MemoryStream();
        context.Response.Body = body;

        var middleware = new GlobalExceptionHandlerMiddleware(
            _ => throw thrown,
            NullLogger<GlobalExceptionHandlerMiddleware>.Instance);

        await middleware.InvokeAsync(context);

        body.Position = 0;
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;

        return new Problem(
            context.Response.StatusCode,
            root.GetProperty("code").GetString()!,
            root.GetProperty("detail").GetString()!,
            root.GetProperty("correlationId").GetString()!);
    }

    [Fact]
    public async Task An_internal_null_fault_is_a_500_that_leaks_no_internal_detail()
    {
        var problem = await CaptureAsync(new ArgumentNullException("participantEmployeeId"));

        Assert.Equal(StatusCodes.Status500InternalServerError, problem.Status);
        Assert.Equal("Performance.Unexpected", problem.Code);

        // The internal parameter name must never reach the client.
        Assert.DoesNotContain("participantEmployeeId", problem.Detail);
        Assert.Equal("An unexpected error occurred.", problem.Detail);
    }

    [Fact]
    public async Task An_out_of_range_fault_is_also_a_500_rather_than_a_client_error()
    {
        var problem = await CaptureAsync(new ArgumentOutOfRangeException("referenceYear", "Must be 2000-2100."));

        Assert.Equal(StatusCodes.Status500InternalServerError, problem.Status);
        Assert.DoesNotContain("referenceYear", problem.Detail);
    }

    [Fact]
    public async Task A_deliberate_argument_error_is_still_a_client_error()
    {
        // Caught after the two internal fault types, so ordering is what separates them.
        var problem = await CaptureAsync(new ArgumentException("Campaign name cannot be empty."));

        Assert.Equal(StatusCodes.Status400BadRequest, problem.Status);
        Assert.Equal("Performance.Invalid", problem.Code);
        Assert.Contains("cannot be empty", problem.Detail);
    }

    [Fact]
    public async Task Domain_validation_carries_its_own_code_and_a_client_status()
    {
        var problem = await CaptureAsync(new DomainValidationException(
            "Weights must total 100%.", "Performance.Round.WeightsInvalid", "objectivesWeightPercent"));

        Assert.Equal(StatusCodes.Status422UnprocessableEntity, problem.Status);
        Assert.Equal("Performance.Round.WeightsInvalid", problem.Code);
    }

    [Fact]
    public async Task A_stale_version_is_a_conflict_the_client_must_reload_for()
    {
        var problem = await CaptureAsync(new ConcurrencyException("PerformanceCycle", Guid.NewGuid()));

        Assert.Equal(StatusCodes.Status409Conflict, problem.Status);
        Assert.Equal("Performance.VersionConflict", problem.Code);
    }

    [Fact]
    public async Task A_tenant_denial_discloses_nothing_about_whether_the_record_exists()
    {
        var problem = await CaptureAsync(new TenantAccessDeniedException("Tenant mismatch on cycle 42."));

        Assert.Equal(StatusCodes.Status403Forbidden, problem.Status);
        Assert.Equal("Performance.Forbidden", problem.Code);

        // Neither the id nor the reason is echoed back.
        Assert.DoesNotContain("42", problem.Detail);
        Assert.Equal("You do not have access to this.", problem.Detail);
    }

    [Fact]
    public async Task A_dependency_outage_is_a_retryable_503()
    {
        var problem = await CaptureAsync(new CoreWorkforceUnavailableException("Core HR timed out."));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, problem.Status);
        Assert.Equal(PerformanceDependencyErrors.CoreWorkforceUnavailableCode, problem.Code);
    }

    [Fact]
    public async Task An_unhandled_fault_is_logged_with_its_correlation_id_and_returns_nothing_internal()
    {
        var problem = await CaptureAsync(new InvalidOperationException("Connection string missing for shard 7."));

        Assert.Equal(StatusCodes.Status500InternalServerError, problem.Status);
        Assert.Equal("Performance.Unexpected", problem.Code);
        Assert.DoesNotContain("shard 7", problem.Detail);

        // The correlation id is what ties the client's report to the logged detail.
        Assert.Equal("corr-123", problem.CorrelationId);
    }

    [Fact]
    public async Task Every_failure_carries_a_correlation_id()
    {
        foreach (var thrown in new Exception[]
                 {
                     new ArgumentNullException("x"),
                     new ArgumentException("bad"),
                     new ConcurrencyException("PerformanceCycle", Guid.NewGuid()),
                     new TenantAccessDeniedException("nope"),
                     new CoreWorkforceUnavailableException("down"),
                     new DomainRuleViolationException("rule"),
                     new EntityNotFoundException("PerformanceCycle", Guid.NewGuid()),
                     new InvalidOperationException("boom")
                 })
        {
            var problem = await CaptureAsync(thrown);
            Assert.Equal("corr-123", problem.CorrelationId);
            Assert.False(string.IsNullOrWhiteSpace(problem.Code));
        }
    }

    // ── Result-based failures, the other half of the contract ──────────────────

    private static (int Status, string Code) FromError(Error error)
    {
        var result = PerformanceProblem.From(new DefaultHttpContext(), error);
        var problem = Assert.IsType<ProblemDetails>(result.Value);

        return (result.StatusCode!.Value, (string)problem.Extensions[PerformanceProblem.CodeExtension]!);
    }

    [Fact]
    public void A_closed_campaign_write_is_a_conflict_carrying_the_closure_code()
    {
        var (status, code) = FromError(CampaignClosureErrors.CampaignClosed());

        Assert.Equal(StatusCodes.Status409Conflict, status);
        Assert.Equal(CampaignClosureErrors.CampaignClosedCode, code);
    }

    [Fact]
    public void A_dependency_failure_result_is_a_503_carrying_its_code()
    {
        var (status, code) = FromError(PerformanceDependencyErrors.CoreWorkforceUnavailable());

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, status);
        Assert.Equal(PerformanceDependencyErrors.CoreWorkforceUnavailableCode, code);
    }

    [Theory]
    [InlineData("PerformanceCycle.NotFound", StatusCodes.Status404NotFound)]
    [InlineData("Attachment.Forbidden", StatusCodes.Status403Forbidden)]
    [InlineData("Skill.NameConflict", StatusCodes.Status409Conflict)]
    [InlineData("Round.WeightsValidation", StatusCodes.Status422UnprocessableEntity)]
    [InlineData("Objective.TitleRequired", StatusCodes.Status400BadRequest)]
    [InlineData("Plan.AlreadySubmitted", StatusCodes.Status409Conflict)]
    public void Result_codes_classify_by_intent(string code, int expectedStatus)
        => Assert.Equal(expectedStatus, PerformanceProblem.ResolveStatus(code));

    [Fact]
    public void A_problem_response_is_served_as_problem_json()
    {
        var result = PerformanceProblem.From(new DefaultHttpContext(), Error.NotFound("PerformanceCycle", Guid.NewGuid()));

        Assert.Contains("application/problem+json", result.ContentTypes);
    }

    [Fact]
    public void Validation_detail_is_carried_per_field()
    {
        var fields = new Dictionary<string, string[]> { ["name"] = ["Name is required."] };
        var result = PerformanceProblem.Create(
            new DefaultHttpContext(), StatusCodes.Status400BadRequest, "Performance.Invalid", "Check the fields.", fields);

        var problem = Assert.IsType<ProblemDetails>(result.Value);
        Assert.Same(fields, problem.Extensions[PerformanceProblem.ErrorsExtension]);
    }
}

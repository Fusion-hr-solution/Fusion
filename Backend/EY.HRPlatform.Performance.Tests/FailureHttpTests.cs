using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Features.Cycles;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.Performance.Tests;

public sealed class FailureHttpTests
{
    private sealed class FailureHandler(Error? error = null, Exception? exception = null)
        : IRequestHandler<GetCycleDetailQuery, Result<CycleDetailDto>>
    {
        public Task<Result<CycleDetailDto>> Handle(GetCycleDetailQuery request, CancellationToken cancellationToken)
        {
            if (exception is not null) throw exception;
            return Task.FromResult(Result.Failure<CycleDetailDto>(error!));
        }
    }

    [Theory]
    [InlineData(FailureKind.NotFound, 404)]
    [InlineData(FailureKind.Forbidden, 403)]
    [InlineData(FailureKind.Validation, 400)]
    [InlineData(FailureKind.InvalidState, 409)]
    [InlineData(FailureKind.Stale, 409)]
    [InlineData(FailureKind.UpstreamUnavailable, 503)]
    public async Task Every_kind_maps_to_status_and_structured_details(FailureKind kind, int status)
        => await AssertFailure(new FailureHandler(PerformanceErrors.Create("Test.Code", "Safe message", kind)), status, "Test.Code", kind);

    [Fact]
    public async Task Controller_capability_denial_returns_the_structured_failure_contract()
    {
        await using var factory = new PerformanceApiFactory();
        using var client = factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(),
            permissions: [new(PerformancePermissions.CycleView, PermissionScopes.Self)]);
        using var response = await client.GetAsync("/api/performance/settings");
        Assert.Equal(403, (int)response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("isSuccess").GetBoolean());
        Assert.Equal("Performance.CapabilityForbidden", body.GetProperty("details").GetProperty("code").GetString());
        Assert.Equal("Forbidden", body.GetProperty("details").GetProperty("kind").GetString());
        Assert.Equal("You do not have permission to do this.", body.GetProperty("errors")[0].GetString());
    }

    [Theory]
    [InlineData("Plan.NotSubmittable", FailureKind.InvalidState, 409)]
    [InlineData("Plan.NotParticipant", FailureKind.Forbidden, 403)]
    [InlineData("Objective.HasChildren", FailureKind.InvalidState, 409)]
    public async Task Codes_previously_misclassified_as_bad_request_keep_their_kind(string code, FailureKind kind, int status)
        => await AssertFailure(new FailureHandler(PerformanceErrors.Create(code, "Safe message", kind)), status, code, kind);

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Core_connection_and_timeout_failures_return_503_without_internal_details(bool timeout)
        => await AssertFailure(new FailureHandler(exception: timeout
            ? new TaskCanceledException("Internal connection information")
            : new HttpRequestException("Internal connection information")), 503, "Core.Unavailable", FailureKind.UpstreamUnavailable);

    [Fact]
    public async Task Unique_index_race_returns_invalid_state()
        => await AssertFailure(new FailureHandler(exception: new DbUpdateException("Private SQL",
            new PostgresException("Private SQL", "ERROR", "ERROR", PostgresErrorCodes.UniqueViolation))),
            409, "Performance.UniqueConflict", FailureKind.InvalidState);

    [Fact]
    public async Task Real_plan_commands_return_forbidden_and_invalid_state_details()
    {
        await using var factory = new PerformanceApiFactory();
        var employee = Guid.NewGuid();
        var start = new DateOnly(2026, 1, 1);
        var cycle = EY.HRPlatform.Performance.Domain.Cycles.PerformanceCycle.CreateDraft(factory.Store.TenantId,
            "FY2026", start, start.AddYears(1), start.AddDays(30)).Activated();
        await using (var db = factory.Store.NewContext())
        {
            db.Cycles.Add(cycle);
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateAuthenticatedClient(employeeId: employee,
            permissions: [new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self)]);
        using var forbidden = await client.PostAsJsonAsync($"/api/performance/cycles/{cycle.Id}/plan", new { expectedVersion = 0 });
        Assert.Equal(403, (int)forbidden.StatusCode);
        var forbiddenBody = await forbidden.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Plan.NotParticipant", forbiddenBody.GetProperty("details").GetProperty("code").GetString());
        Assert.Equal("Forbidden", forbiddenBody.GetProperty("details").GetProperty("kind").GetString());
        await using (var db = factory.Store.NewContext())
        {
            db.EmployeePlans.Add(EY.HRPlatform.Performance.Domain.Plans.EmployeePlan.Create(factory.Store.TenantId,
                cycle.Id, Guid.NewGuid(), employee, "Employee", "Team", Guid.NewGuid(), "Manager"));
            await db.SaveChangesAsync();
        }
        using var invalid = await client.PostAsJsonAsync($"/api/performance/cycles/{cycle.Id}/plan/submit", new { expectedVersion = 0 });
        Assert.Equal(409, (int)invalid.StatusCode);
        var invalidBody = await invalid.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Plan.NotSubmittable", invalidBody.GetProperty("details").GetProperty("code").GetString());
        Assert.Equal("InvalidState", invalidBody.GetProperty("details").GetProperty("kind").GetString());
    }

    [Fact]
    public async Task Mutation_rejects_a_missing_expected_version()
    {
        await using var factory = new PerformanceApiFactory();
        using var client = factory.CreateAuthenticatedClient(employeeId: Guid.NewGuid(),
            permissions: [new(PerformancePermissions.ObjectiveSelfManage, PermissionScopes.Self)]);
        using var response = await client.PostAsJsonAsync($"/api/performance/cycles/{Guid.NewGuid()}/plan/submit", new { });
        Assert.Equal(400, (int)response.StatusCode);
        await using var db = factory.Store.NewContext();
        Assert.Empty(db.PlanDecisions);
    }

    private static async Task AssertFailure(FailureHandler handler, int status, string code, FailureKind kind)
    {
        await using var parent = new PerformanceApiFactory();
        await using var factory = parent.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.RemoveAll<IRequestHandler<GetCycleDetailQuery, Result<CycleDetailDto>>>();
            services.AddSingleton<IRequestHandler<GetCycleDetailQuery, Result<CycleDetailDto>>>(handler);
        }));
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", PerformanceTestJwt.Issue(parent.Store.TenantId,
            Guid.NewGuid(), [new(PerformancePermissions.CycleView, PermissionScopes.Self)], [ModuleEntitlements.Performance]));
        using var response = await client.GetAsync($"/api/performance/cycles/{Guid.NewGuid()}");
        Assert.Equal(status, (int)response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(code, body.GetProperty("details").GetProperty("code").GetString());
        Assert.Equal(kind.ToString(), body.GetProperty("details").GetProperty("kind").GetString());
        Assert.DoesNotContain("Internal connection", body.ToString());
        Assert.DoesNotContain("Private SQL", body.ToString());
    }
}

using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.Performance.Tests.Infrastructure.Workforce;

/// <summary>
/// A Core HR outage must reach the caller as a recoverable failure result — never as an internal
/// fault, and never as a partial result computed from an incomplete workforce read.
/// </summary>
public sealed class CoreDependencyFailureBehaviorTests
{
    [Fact]
    public async Task Outage_becomes_a_recoverable_failure_on_a_valued_result()
    {
        var behavior = new CoreDependencyFailureBehavior<string, Result<int>>(
            NullLogger<CoreDependencyFailureBehavior<string, Result<int>>>.Instance);

        var response = await behavior.Handle(
            "any-request",
            _ => throw new CoreWorkforceUnavailableException("Core HR timed out."),
            CancellationToken.None);

        Assert.True(response.IsFailure);
        Assert.Equal(PerformanceDependencyErrors.CoreWorkforceUnavailableCode, response.Error.Code);
    }

    [Fact]
    public async Task Outage_becomes_a_recoverable_failure_on_a_valueless_result()
    {
        var behavior = new CoreDependencyFailureBehavior<string, Result>(
            NullLogger<CoreDependencyFailureBehavior<string, Result>>.Instance);

        var response = await behavior.Handle(
            "any-request",
            _ => throw new CoreWorkforceUnavailableException("Core HR refused the connection."),
            CancellationToken.None);

        Assert.True(response.IsFailure);
        Assert.Equal(PerformanceDependencyErrors.CoreWorkforceUnavailableCode, response.Error.Code);
    }

    [Fact]
    public async Task A_successful_handler_passes_through_untouched()
    {
        var behavior = new CoreDependencyFailureBehavior<string, Result<int>>(
            NullLogger<CoreDependencyFailureBehavior<string, Result<int>>>.Instance);

        var response = await behavior.Handle(
            "any-request",
            _ => Task.FromResult(Result.Success(42)),
            CancellationToken.None);

        Assert.True(response.IsSuccess);
        Assert.Equal(42, response.Value);
    }

    [Fact]
    public async Task An_unrelated_failure_is_not_reclassified_as_a_dependency_problem()
    {
        var behavior = new CoreDependencyFailureBehavior<string, Result<int>>(
            NullLogger<CoreDependencyFailureBehavior<string, Result<int>>>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() => behavior.Handle(
            "any-request",
            _ => throw new InvalidOperationException("A genuine defect."),
            CancellationToken.None));
    }

    [Fact]
    public async Task A_caller_cancellation_is_not_reported_as_a_dependency_failure()
    {
        var behavior = new CoreDependencyFailureBehavior<string, Result<int>>(
            NullLogger<CoreDependencyFailureBehavior<string, Result<int>>>.Instance);

        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => behavior.Handle(
            "any-request",
            token => throw new OperationCanceledException(token),
            cancellation.Token));
    }
}

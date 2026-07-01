using EY.HRPlatform.Training.Features.Admin.Budget;

namespace EY.HRPlatform.Training.Tests.TestHelpers;

/// <summary>No-op budget alert notifier for handler tests that don't exercise threshold alerts.</summary>
public sealed class NoOpBudgetAlertNotifier : IBudgetAlertNotifier
{
    public Task NotifyOnSessionCostChangeAsync(
        Guid sessionId, decimal oldSessionTotal, decimal newSessionTotal, CancellationToken cancellationToken)
        => Task.CompletedTask;
}

namespace EY.HRPlatform.Training.Features.Admin.Budget;

public interface IBudgetAlertNotifier
{
    /// <summary>
    /// After a session's external cost changes, detect whether the sponsoring service line's budget
    /// crossed a new 80/90/100% threshold and, if so, send a best-effort alert email. Never throws.
    /// </summary>
    Task NotifyOnSessionCostChangeAsync(
        Guid sessionId, decimal oldSessionTotal, decimal newSessionTotal, CancellationToken cancellationToken);
}

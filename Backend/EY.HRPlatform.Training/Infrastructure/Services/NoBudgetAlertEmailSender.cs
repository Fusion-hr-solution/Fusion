namespace EY.HRPlatform.Training.Infrastructure.Services;

/// <summary>No-op sender used when budget alert email delivery is disabled or unconfigured.</summary>
public sealed class NoBudgetAlertEmailSender(
    ILogger<NoBudgetAlertEmailSender> logger) : IBudgetAlertEmailSender
{
    public Task<BudgetAlertEmailDeliveryResult> SendBudgetAlertAsync(
        BudgetAlertEmailMessage message,
        CancellationToken cancellationToken)
    {
        logger.LogInformation(
            "Skipping budget alert email for BudgetId={BudgetId} ServiceLineId={ServiceLineId} Threshold={Threshold} because delivery is disabled.",
            message.BudgetId, message.ServiceLineId, message.ThresholdPercent);

        return Task.FromResult(BudgetAlertEmailDeliveryResult.Suppressed("Budget alert email disabled."));
    }
}

namespace EY.HRPlatform.Training.Infrastructure.Services;

public interface IBudgetAlertEmailSender
{
    Task<BudgetAlertEmailDeliveryResult> SendBudgetAlertAsync(
        BudgetAlertEmailMessage message,
        CancellationToken cancellationToken);
}

public sealed record BudgetAlertEmailMessage(
    Guid BudgetId,
    Guid ServiceLineId,
    string ServiceLineName,
    int ThresholdPercent,
    decimal AllocatedAmount,
    decimal SpendAmount,
    decimal PercentConsumed,
    DateTime PeriodStart,
    DateTime PeriodEnd);

public static class BudgetAlertEmailDeliveryStates
{
    public const string Sent = "Sent";
    public const string Suppressed = "Suppressed";
    public const string Failed = "Failed";
}

public sealed record BudgetAlertEmailDeliveryResult(string Status, string Message)
{
    public static BudgetAlertEmailDeliveryResult Sent(string message = "Budget alert email sent.")
        => new(BudgetAlertEmailDeliveryStates.Sent, message);

    public static BudgetAlertEmailDeliveryResult Suppressed(string message)
        => new(BudgetAlertEmailDeliveryStates.Suppressed, message);

    public static BudgetAlertEmailDeliveryResult Failed(string message)
        => new(BudgetAlertEmailDeliveryStates.Failed, message);
}

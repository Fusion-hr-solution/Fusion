using EY.HRPlatform.Training.Infrastructure.Services;

namespace EY.HRPlatform.Training.Tests.TestHelpers;

/// <summary>Records every budget alert message so tests can assert which threshold fired.</summary>
public sealed class RecordingBudgetAlertEmailSender : IBudgetAlertEmailSender
{
    public List<BudgetAlertEmailMessage> Sent { get; } = [];
    public BudgetAlertEmailMessage? Last => Sent.Count == 0 ? null : Sent[^1];

    public Task<BudgetAlertEmailDeliveryResult> SendBudgetAlertAsync(
        BudgetAlertEmailMessage message, CancellationToken cancellationToken)
    {
        Sent.Add(message);
        return Task.FromResult(BudgetAlertEmailDeliveryResult.Sent());
    }
}

/// <summary>Always throws — used to prove the notifier is best-effort and never breaks the save.</summary>
public sealed class ThrowingBudgetAlertEmailSender : IBudgetAlertEmailSender
{
    public Task<BudgetAlertEmailDeliveryResult> SendBudgetAlertAsync(
        BudgetAlertEmailMessage message, CancellationToken cancellationToken)
        => throw new InvalidOperationException("Simulated SMTP failure.");
}

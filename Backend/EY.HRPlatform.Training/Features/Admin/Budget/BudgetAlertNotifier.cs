using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Budget;

public sealed class BudgetAlertNotifier(
    TrainingDbContext db,
    IBudgetAlertEmailSender sender,
    ILogger<BudgetAlertNotifier> logger) : IBudgetAlertNotifier
{
    public async Task NotifyOnSessionCostChangeAsync(
        Guid sessionId, decimal oldSessionTotal, decimal newSessionTotal, CancellationToken cancellationToken)
    {
        try
        {
            // Resolve the session's sponsoring service line + scheduled date.
            var info = await db.TrainingSessions
                .AsNoTracking()
                .IgnoreQueryFilters()
                .Where(s => s.Id == sessionId)
                .Select(s => new
                {
                    s.StartUtc,
                    s.Part.Training.CostType,
                    s.Part.Training.SponsoringServiceLineId,
                })
                .FirstOrDefaultAsync(cancellationToken);

            // Only external trainings with a sponsoring service line draw on a budget.
            if (info is null || info.CostType != CostType.External || info.SponsoringServiceLineId is null)
                return;

            var serviceLineId = info.SponsoringServiceLineId.Value;

            // Find the budget covering the session's date for that service line.
            var budget = await db.TrainingBudgets
                .AsNoTracking()
                .FirstOrDefaultAsync(b =>
                    b.ServiceLineId == serviceLineId &&
                    b.PeriodStart <= info.StartUtc && info.StartUtc < b.PeriodEnd, cancellationToken);

            if (budget is null || budget.AllocatedAmount <= 0m)
                return;

            var afterSpend = await BudgetSpendCalculator.ComputeSpendAsync(
                db, serviceLineId, budget.PeriodStart, budget.PeriodEnd, cancellationToken);
            var beforeSpend = afterSpend - (newSessionTotal - oldSessionTotal);

            var beforePct = beforeSpend / budget.AllocatedAmount * 100m;
            var afterPct = afterSpend / budget.AllocatedAmount * 100m;

            var crossed = BudgetThresholds.HighestNewlyCrossed(beforePct, afterPct);
            if (crossed is null)
                return;

            var serviceLineName = await db.ServiceLines
                .AsNoTracking()
                .Where(s => s.Id == serviceLineId)
                .Select(s => s.Name)
                .FirstOrDefaultAsync(cancellationToken) ?? "Unknown";

            await sender.SendBudgetAlertAsync(
                new BudgetAlertEmailMessage(
                    budget.Id, serviceLineId, serviceLineName, crossed.Value,
                    budget.AllocatedAmount, afterSpend, Math.Round(afterPct, 2),
                    budget.PeriodStart, budget.PeriodEnd),
                cancellationToken);
        }
        catch (Exception ex)
        {
            // Best-effort: a failed alert must never break the cost-save transaction.
            logger.LogWarning(ex, "Budget threshold alert failed for session {SessionId}.", sessionId);
        }
    }
}

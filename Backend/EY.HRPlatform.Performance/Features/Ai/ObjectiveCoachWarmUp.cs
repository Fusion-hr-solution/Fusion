using EY.HRPlatform.Performance.Infrastructure.Ai;
using EY.HRPlatform.Performance.Models;

namespace EY.HRPlatform.Performance.Features.Ai;

/// <summary>
/// Sends the coach's request once at startup with a made-up draft, so the provider has compiled the
/// coach's answer schema before the first author asks (a cold first call can outlast the 10 s budget).
/// Nothing is audited or stored: no tenant and no person is involved.
/// </summary>
public sealed class ObjectiveCoachWarmUp(IServiceScopeFactory scopes, ILogger<ObjectiveCoachWarmUp> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var scope = scopes.CreateScope();
        var ai = scope.ServiceProvider.GetRequiredService<IPerformanceAiProvider>();
        if (!ai.IsAvailable) return;
        var draft = new ObjectiveCoachRequest(ObjectiveCoachSurface.Plan, null, "Improve onboarding", null, null, null);
        await ai.WarmUpAsync(new PerformanceAiRequest(
            RunObjectiveCoachHandler.Instructions,
            RunObjectiveCoachHandler.ProviderInput(draft.Title, draft, null, [], null),
            RunObjectiveCoachHandler.AnswerSchemaName,
            RunObjectiveCoachHandler.Schema), stoppingToken);
        logger.LogInformation("Objective coach warm-up sent ({Provider}/{Model})", ai.ProviderName, ai.Model);
    }
}

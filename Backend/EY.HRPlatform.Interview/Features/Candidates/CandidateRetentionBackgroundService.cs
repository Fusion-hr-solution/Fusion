namespace EY.HRPlatform.Interview.Features.Candidates;

public class CandidateRetentionBackgroundService(
    IServiceProvider serviceProvider,
    IConfiguration configuration,
    ILogger<CandidateRetentionBackgroundService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var startupDelay = TimeSpan.FromSeconds(
            configuration.GetValue<int?>("CandidateRetention:StartupDelaySeconds") ?? 30);

        logger.LogInformation(
            "CandidateRetentionBackgroundService starting; waiting {Delay}s before first scan.",
            startupDelay.TotalSeconds);

        await Task.Delay(startupDelay, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var scanIntervalHours = configuration.GetValue<int?>("CandidateRetention:ScanIntervalHours") ?? 24;

            try
            {
                await using var scope = serviceProvider.CreateAsyncScope();
                var retentionService = scope.ServiceProvider.GetRequiredService<ICandidateRetentionService>();

                var state = await retentionService.GetStateAsync(stoppingToken);

                if (state.Settings.Enabled)
                {
                    scanIntervalHours = state.Settings.ScanIntervalHours;
                    logger.LogInformation(
                        "CandidateRetentionBackgroundService: running scheduled sweep (period={Period}d, action={Action}).",
                        state.Settings.RetentionPeriodDays,
                        state.Settings.RetentionAction);

                    await retentionService.RunRetentionSweepAsync("RetentionJob", "Scheduled", stoppingToken);
                }
                else
                {
                    logger.LogDebug("CandidateRetentionBackgroundService: retention is disabled; skipping sweep.");
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "CandidateRetentionBackgroundService: sweep failed.");
            }

            await Task.Delay(TimeSpan.FromHours(scanIntervalHours), stoppingToken);
        }
    }
}

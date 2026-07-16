namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

public sealed class EmployeeImportApplyBackgroundService(
    IEmployeeImportApplyQueueProcessor queueProcessor,
    ILogger<EmployeeImportApplyBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMilliseconds(1000);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation(
            "EmployeeImportApplyBackgroundService started.");

        await Task.Delay(TimeSpan.FromMilliseconds(200), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var processed = false;
            try
            {
                processed = await queueProcessor.ProcessNextOperationAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Employee import apply worker failed unexpectedly.");
            }

            // Drain queued imports back-to-back; only idle-wait when the last poll found no work.
            if (!processed)
                await Task.Delay(Interval, stoppingToken);
        }
    }
}

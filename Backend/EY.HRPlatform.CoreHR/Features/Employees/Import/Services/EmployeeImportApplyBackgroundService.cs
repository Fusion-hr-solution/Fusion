using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

public sealed class EmployeeImportApplyBackgroundService(
    IServiceProvider serviceProvider,
    ILogger<EmployeeImportApplyBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMilliseconds(1000);
    private static readonly TimeSpan LockTimeout = TimeSpan.FromMinutes(10);
    private readonly string _instanceId = Guid.NewGuid().ToString("N")[..8];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation(
            "EmployeeImportApplyBackgroundService started (instance={InstanceId}).",
            _instanceId);

        await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessNextOperationAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Employee import apply worker failed unexpectedly.");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task ProcessNextOperationAsync(CancellationToken cancellationToken)
    {
        await using var scope = serviceProvider.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CoreHRDbContext>();

        var staleThreshold = DateTime.UtcNow - LockTimeout;
        var acquired = await dbContext.EmployeeImportApplyOperations
            .Where(operation =>
                operation.Status != EmployeeImportApplyOperationStatus.Succeeded
                && operation.Status != EmployeeImportApplyOperationStatus.Failed
                && (operation.LockedAt == null || operation.LockedAt < staleThreshold))
            .OrderBy(operation => operation.CreatedAt)
            .Take(1)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(operation => operation.LockedAt, DateTime.UtcNow)
                    .SetProperty(operation => operation.LockedBy, _instanceId),
                cancellationToken);

        if (acquired == 0)
            return;

        var operationId = await dbContext.EmployeeImportApplyOperations
            .Where(operation =>
                operation.LockedBy == _instanceId
                && operation.Status != EmployeeImportApplyOperationStatus.Succeeded
                && operation.Status != EmployeeImportApplyOperationStatus.Failed)
            .OrderBy(operation => operation.CreatedAt)
            .Select(operation => operation.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (operationId == Guid.Empty)
            return;

        var workflowService = scope.ServiceProvider.GetRequiredService<IEmployeeImportWorkflowService>();
        await workflowService.ProcessApplyOperationAsync(operationId, cancellationToken);
    }
}

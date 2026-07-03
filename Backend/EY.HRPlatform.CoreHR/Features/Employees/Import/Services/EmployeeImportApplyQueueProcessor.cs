using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

public interface IEmployeeImportApplyQueueProcessor
{
    Task<bool> ProcessNextOperationAsync(CancellationToken cancellationToken);
}

public sealed class EmployeeImportApplyQueueProcessor(IServiceProvider serviceProvider) : IEmployeeImportApplyQueueProcessor
{
    private static readonly TimeSpan LockTimeout = TimeSpan.FromMinutes(10);
    private const string InMemoryProvider = "Microsoft.EntityFrameworkCore.InMemory";

    public async Task<bool> ProcessNextOperationAsync(CancellationToken cancellationToken)
    {
        await using var scope = serviceProvider.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CoreHRDbContext>();
        var instanceId = Guid.NewGuid().ToString("N")[..8];
        var staleThreshold = DateTime.UtcNow - LockTimeout;

        var acquired = await TryAcquireAsync(dbContext, instanceId, staleThreshold, cancellationToken);

        if (acquired == 0)
            return false;

        var claimed = await dbContext.EmployeeImportApplyOperations
            .IgnoreQueryFilters()
            .Where(operation =>
                operation.LockedBy == instanceId
                && (operation.Status == EmployeeImportApplyOperationStatus.Queued
                    || operation.Status == EmployeeImportApplyOperationStatus.Running))
            .OrderBy(operation => operation.CreatedAt)
            .Select(operation => new { operation.Id, operation.TenantId })
            .FirstOrDefaultAsync(cancellationToken);

        if (claimed is null || claimed.Id == Guid.Empty || claimed.TenantId == Guid.Empty)
            return false;

        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(claimed.TenantId);

        var workflowService = scope.ServiceProvider.GetRequiredService<IEmployeeImportWorkflowService>();
        await workflowService.ProcessApplyOperationAsync(claimed.Id, cancellationToken);
        return true;
    }

    private static async Task<int> TryAcquireAsync(
        CoreHRDbContext dbContext,
        string instanceId,
        DateTime staleThreshold,
        CancellationToken cancellationToken)
    {
        var claimableOperations = dbContext.EmployeeImportApplyOperations
            .IgnoreQueryFilters()
            .Where(operation =>
                (operation.Status == EmployeeImportApplyOperationStatus.Queued
                    || operation.Status == EmployeeImportApplyOperationStatus.Running)
                && (operation.LockedAt == null || operation.LockedAt < staleThreshold))
            .OrderBy(operation => operation.CreatedAt);

        if (string.Equals(dbContext.Database.ProviderName, InMemoryProvider, StringComparison.OrdinalIgnoreCase))
        {
            var operation = await claimableOperations.FirstOrDefaultAsync(cancellationToken);
            if (operation is null)
                return 0;

            operation.AcquireLock(instanceId, DateTime.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return 1;
        }

        return await claimableOperations
            .Take(1)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(operation => operation.LockedAt, DateTime.UtcNow)
                    .SetProperty(operation => operation.LockedBy, instanceId),
                cancellationToken);
    }
}

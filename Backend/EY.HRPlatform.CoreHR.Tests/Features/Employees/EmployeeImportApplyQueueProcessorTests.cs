using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeeImportApplyQueueProcessorTests
{
    private static readonly Guid TenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public async Task ProcessNextOperationAsync_ClaimsQueuedOperationWithoutRequestTenant_AndSetsScopedTenant()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
        services.AddDbContext<CoreHRDbContext>(options => options.UseInMemoryDatabase(dbName));
        services.AddSingleton<WorkflowCallRecorder>();
        services.AddScoped<IEmployeeImportWorkflowService, RecordingWorkflowService>();
        services.AddScoped<IEmployeeImportApplyQueueProcessor, EmployeeImportApplyQueueProcessor>();

        await using var provider = services.BuildServiceProvider();

        await using (var seedScope = provider.CreateAsyncScope())
        {
            var context = seedScope.ServiceProvider.GetRequiredService<CoreHRDbContext>();
            context.EmployeeImportApplyOperations.Add(EmployeeImportApplyOperation.Queue(
                TenantId,
                Guid.NewGuid(),
                Guid.Parse("22222222-2222-2222-2222-222222222222"),
                "HR Admin",
                "HRAdmin",
                1200,
                1200,
                DateTime.UtcNow));
            await context.SaveChangesAsync();
        }

        await using var scope = provider.CreateAsyncScope();
        var processor = scope.ServiceProvider.GetRequiredService<IEmployeeImportApplyQueueProcessor>();
        var processed = await processor.ProcessNextOperationAsync(CancellationToken.None);
        var recorder = scope.ServiceProvider.GetRequiredService<WorkflowCallRecorder>();

        Assert.True(processed);
        Assert.Single(recorder.Calls);
        Assert.Equal(TenantId, recorder.Calls[0].TenantId);

        await using var verifyScope = provider.CreateAsyncScope();
        var verifyContext = verifyScope.ServiceProvider.GetRequiredService<CoreHRDbContext>();
        var claimed = await verifyContext.EmployeeImportApplyOperations
            .IgnoreQueryFilters()
            .SingleAsync();

        Assert.NotNull(claimed.LockedAt);
        Assert.False(string.IsNullOrWhiteSpace(claimed.LockedBy));
    }

    [Fact]
    public async Task ProcessNextOperationAsync_ReturnsFalseWhenQueueIsEmpty()
    {
        var dbName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
        services.AddDbContext<CoreHRDbContext>(options => options.UseInMemoryDatabase(dbName));
        services.AddSingleton<WorkflowCallRecorder>();
        services.AddScoped<IEmployeeImportWorkflowService, RecordingWorkflowService>();
        services.AddScoped<IEmployeeImportApplyQueueProcessor, EmployeeImportApplyQueueProcessor>();

        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var processor = scope.ServiceProvider.GetRequiredService<IEmployeeImportApplyQueueProcessor>();

        var processed = await processor.ProcessNextOperationAsync(CancellationToken.None);

        Assert.False(processed);
        Assert.Empty(scope.ServiceProvider.GetRequiredService<WorkflowCallRecorder>().Calls);
    }

    private sealed class WorkflowCallRecorder
    {
        public List<WorkflowCall> Calls { get; } = [];
    }

    private sealed record WorkflowCall(Guid OperationId, Guid TenantId);

    private sealed class RecordingWorkflowService(
        ITenantContext tenantContext,
        WorkflowCallRecorder recorder) : IEmployeeImportWorkflowService
    {
        public Task<EmployeeImportSchemaDto> GetSchemaAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<(byte[] Content, string FileName)> BuildTemplateAsync(IReadOnlyCollection<string>? fields, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeImportSessionDto> UploadAsync(IFormFile file, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeImportSessionDto> UploadAsync(IFormFile file, DateTime batchEffectiveDate, EmployeeImportMode importMode, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeImportSessionDto> ValidateAsync(Guid sessionId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeImportSessionDto> ValidateAsync(Guid sessionId, int previewPageNumber, int previewPageSize, string previewFilter, string? groupKey, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeImportSessionDto> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeImportSessionDto> GetSessionAsync(Guid sessionId, int previewPageNumber, int previewPageSize, string previewFilter, string? groupKey, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeImportApplyOperationDto> ApplyAsync(Guid sessionId, EmployeeImportActorDto actor, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeImportApplyOperationDto> GetApplyOperationAsync(Guid sessionId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeImportHistoryPageDto> GetHistoryAsync(int pageNumber, int pageSize, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<EmployeeImportHistoryDetailDto> GetHistoryDetailAsync(Guid historyId, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task ProcessApplyOperationAsync(Guid operationId, CancellationToken cancellationToken)
        {
            recorder.Calls.Add(new WorkflowCall(operationId, tenantContext.TenantId));
            return Task.CompletedTask;
        }
    }
}

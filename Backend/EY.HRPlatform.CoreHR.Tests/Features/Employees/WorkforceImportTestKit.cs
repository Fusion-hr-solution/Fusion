using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Imports;
using EY.HRPlatform.CoreHR.Infrastructure.Imports.Semantic;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.Extensions.Logging.Abstractions;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

/// <summary>Builds the Workforce Import services over one context, as DI would.</summary>
internal static class WorkforceImportTestKit
{
    public static WorkforceImportDerivation Derivation(CoreHRDbContext db, Guid tenantId)
        => new(db, new WorkforceImportInterpreter(), new WorkforceImportResolver(),
            new WorkforceImportSnapshotLoader(db, new OrganizationService(db, TestTenantContext.WithTenant(tenantId))));

    public static WorkforceImportSemanticAssistanceService Semantic(
        CoreHRDbContext db,
        Guid tenantId,
        IWorkforceImportSemanticProvider? provider = null,
        WorkforceImportSemanticAssistanceOptions? options = null)
        => new(db, TestTenantContext.WithTenant(tenantId), Derivation(db, tenantId), new WorkforceImportSemanticContextBuilder(),
            provider ?? new UnconfiguredProvider(), options ?? new WorkforceImportSemanticAssistanceOptions { MaxRetries = 0 },
            NullLogger<WorkforceImportSemanticAssistanceService>.Instance);

    public static WorkforceImportSessionService Sessions(CoreHRDbContext db, Guid tenantId, IWorkforceImportSemanticProvider? provider = null)
        => new(db, TestTenantContext.WithTenant(tenantId), new SafeTabularSourceReader(), new WorkforceImportSourceAdapter(),
            Derivation(db, tenantId), Semantic(db, tenantId, provider));

    public static WorkforceImportReviewService Review(CoreHRDbContext db, Guid tenantId)
        => new(db, Derivation(db, tenantId), Semantic(db, tenantId));

    public static WorkforceImportApplyOrchestrator Orchestrator(CoreHRDbContext db, Guid tenantId)
    {
        var tenantContext = TestTenantContext.WithTenant(tenantId);
        return new WorkforceImportApplyOrchestrator(db, tenantContext, Derivation(db, tenantId),
            new WorkforceMutationService(db, tenantContext, new WorkforceCanonicalResolver(db)),
            new EmployeeNumberAllocatorService(db, tenantContext));
    }

    public static WorkforceImportApplyOperationService Publication(CoreHRDbContext db, Guid tenantId)
        => new(db, TestTenantContext.WithTenant(tenantId));

    /// <summary>A provider that is not configured: assistance is skipped and Match stays manual.</summary>
    public sealed class UnconfiguredProvider : IWorkforceImportSemanticProvider
    {
        public string ProviderName => "Groq";
        public string ModelName => "test-model";
        public bool IsConfigured => false;

        public Task<ImportSemanticProviderResult> SuggestAsync(WorkforceImportSemanticRequest request, CancellationToken cancellationToken)
            => throw new ImportSemanticProviderException(ImportSemanticFailureCategory.NotConfigured, "Not configured.");
    }

    /// <summary>A scripted provider: answers each call from the given function and records what it was sent.</summary>
    public sealed class ScriptedProvider(Func<WorkforceImportSemanticRequest, ImportSemanticProviderResult> answer) : IWorkforceImportSemanticProvider
    {
        public List<WorkforceImportSemanticRequest> Requests { get; } = [];
        public string ProviderName => "Groq";
        public string ModelName => "test-model";
        public bool IsConfigured => true;

        public Task<ImportSemanticProviderResult> SuggestAsync(WorkforceImportSemanticRequest request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return Task.FromResult(answer(request));
        }
    }
}

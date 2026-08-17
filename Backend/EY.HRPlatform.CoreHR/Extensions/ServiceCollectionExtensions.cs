using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddCoreHRApplication(this IServiceCollection services, IConfiguration configuration)
    {
        // Register MediatR - scans this assembly for all command/query handlers
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblyContaining<Program>());
        services.AddHttpContextAccessor();
        services.AddMemoryCache();
        var internalServiceAuthentication = configuration
            .GetSection(InternalServiceAuthenticationOptions.SectionName)
            .Get<InternalServiceAuthenticationOptions>() ?? new InternalServiceAuthenticationOptions();
        services.AddSingleton<IInternalServiceRequestAuthorizer>(sp => new InternalServiceRequestAuthorizer(
            sp.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>(),
            internalServiceAuthentication));
        services.AddSingleton<IInternalServiceRequestSigner>(_ => new InternalServiceRequestSigner(
            internalServiceAuthentication));

        services.AddHttpClient<IWorkforceAccountStatusReader, IdentityWorkforceAccountStatusReader>(client =>
        {
            var baseUrl = configuration["ServiceUrls:IdentityApiBaseUrl"];
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                throw new InvalidOperationException(
                    "ServiceUrls:IdentityApiBaseUrl is not configured. Set it via environment variable or appsettings.");
            }

            client.BaseAddress = new Uri(EnsureTrailingSlash(baseUrl));
        });

        services.AddScoped<IEmployeeDetailsReadModelService, EmployeeDetailsReadModelService>();
        services.AddScoped<ICoreAccessPolicyService, CoreAccessPolicyService>();
        services.AddScoped<ITenantSettingsReadService, TenantSettingsReadService>();
        services.AddScoped<ISettingsSectionRegistry, SettingsSectionRegistry>();
        services.AddScoped<ISettingsAuditService, SettingsAuditService>();
        services.AddScoped<IEmployeeImportWorkflowService, EmployeeImportWorkflowService>();
        services.AddSingleton<IEmployeeImportApplyQueueProcessor, EmployeeImportApplyQueueProcessor>();
        services.AddScoped<IWorkforceContractService, WorkforceContractService>();
        services.AddScoped<IInternalWorkforceSnapshotService, InternalWorkforceSnapshotService>();
        services.AddScoped<IApplicabilityOptionsService, ApplicabilityOptionsService>();
        services.AddScoped<WorkforceResolutionScope>();
        services.AddScoped<IWorkforceCanonicalResolver, WorkforceCanonicalResolver>();
        services.AddScoped<IWorkforceMutationService, WorkforceMutationService>();
        services.AddScoped<IEmployeeNumberAllocator, EmployeeNumberAllocatorService>();
        services.AddScoped<IWorkEmailOccupancyService, WorkEmailOccupancyService>();
        services.AddScoped<IOrganizationService, OrganizationService>();
        services.AddScoped<IOrganizationImportSourceInspectionService, OrganizationImportSourceInspectionService>();
        services.AddScoped<IOrganizationImportWorkbookService, OrganizationImportWorkbookService>();
        services.AddScoped<IOrganizationImportService, OrganizationImportService>();
        services.AddScoped<IOrganizationImportInterpreter, OrganizationImportInterpreter>();
        var semanticAssistance = configuration
            .GetSection(OrganizationImportSemanticAssistanceOptions.SectionName)
            .Get<OrganizationImportSemanticAssistanceOptions>() ?? new OrganizationImportSemanticAssistanceOptions();
        semanticAssistance.ApiKey = string.IsNullOrWhiteSpace(semanticAssistance.ApiKey)
            ? configuration["GROQ_API_KEY"]
            : semanticAssistance.ApiKey;
        ValidateSemanticAssistance(semanticAssistance);
        services.AddSingleton(semanticAssistance);
        services.AddScoped<IOrganizationImportSemanticContextBuilder, OrganizationImportSemanticContextBuilder>();
        services.AddScoped<IOrganizationImportSemanticAssistanceService, OrganizationImportSemanticAssistanceService>();
        services.AddHttpClient<IOrganizationImportSemanticProvider, GroqOrganizationImportSemanticProvider>(client =>
        {
            client.BaseAddress = new Uri(EnsureTrailingSlash(semanticAssistance.Endpoint));
            client.Timeout = Timeout.InfiniteTimeSpan;
        }).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false });
        services.AddHostedService<EmployeeImportApplyBackgroundService>();

        services.AddHttpClient<IWorkforceBulkProvisioner, WorkforceBulkProvisioner>(client =>
        {
            var baseUrl = configuration["ServiceUrls:IdentityApiBaseUrl"];
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                throw new InvalidOperationException(
                    "ServiceUrls:IdentityApiBaseUrl is not configured. Set it via environment variable or appsettings.");
            }

            client.BaseAddress = new Uri(EnsureTrailingSlash(baseUrl));
        });

        return services;
    }

    private static string EnsureTrailingSlash(string url)
        => url.EndsWith('/') ? url : $"{url}/";

    private static void ValidateSemanticAssistance(OrganizationImportSemanticAssistanceOptions options)
    {
        if (!string.Equals(options.Provider, OrganizationImportSemanticAssistanceOptions.DefaultProvider, StringComparison.Ordinal))
            throw new InvalidOperationException("OrganizationImport:SemanticAssistance:Provider must be Groq.");
        if (string.IsNullOrWhiteSpace(options.Model))
            throw new InvalidOperationException("OrganizationImport:SemanticAssistance:Model is required.");
        if (!Uri.TryCreate(options.Endpoint, UriKind.Absolute, out var endpoint)
            || (endpoint.Scheme != Uri.UriSchemeHttps && !endpoint.IsLoopback)
            || (!endpoint.IsLoopback && !string.Equals(endpoint.Host, "api.groq.com", StringComparison.OrdinalIgnoreCase))
            || !string.IsNullOrEmpty(endpoint.UserInfo)
            || !string.IsNullOrEmpty(endpoint.Query)
            || !string.IsNullOrEmpty(endpoint.Fragment))
            throw new InvalidOperationException("OrganizationImport:SemanticAssistance:Endpoint must use api.groq.com over HTTPS or a loopback development URL.");
        if (options.TimeoutSeconds is < 1 or > 60
            || options.MaxFields is < 1 or > 32
            || options.MaxValuesPerField is < 1 or > 8
            || options.MaxTotalValues is < 1 or > 64
            || options.MaxValueCharacters is < 16 or > 120
            || options.MaxPayloadBytes is < 4096 or > 20480
            || options.MaxRationaleCharacters is < 40 or > 180
            || string.IsNullOrWhiteSpace(options.ContractVersion))
            throw new InvalidOperationException("OrganizationImport:SemanticAssistance contains an invalid non-secret limit or contract version.");
    }

    public static IServiceCollection AddMultitenancy(this IServiceCollection services)
    {
        // TenantContext is scoped - one instance per request
        // Register concrete type first, then interface pointing to same instance
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

        // Interceptor validates tenant context on SaveChanges
        services.AddScoped<TenantSaveChangesInterceptor>();

        return services;
    }

    public static IServiceCollection AddCoreHRPersistence(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("CoreHRDb");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("ConnectionStrings:CoreHRDb is not configured. Set it via environment variable or appsettings.");

        services.AddDbContext<CoreHRDbContext>((sp, options) =>
        {
            options.UseNpgsql(
                connectionString,
                npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "corehr"));

            // Add tenant validation interceptor (requires multitenancy services via AddMultitenancy())
            var tenantInterceptor = sp.GetService<TenantSaveChangesInterceptor>();
            if (tenantInterceptor is null)
            {
                throw new InvalidOperationException(
                    "TenantSaveChangesInterceptor is not registered. Ensure AddMultitenancy() is called to register multitenancy services.");
            }
            options.AddInterceptors(tenantInterceptor);
        });

        services.AddHealthChecks()
            .AddDbContextCheck<CoreHRDbContext>(
                name: "corehr-db",
                tags: ["ready"]);

        return services;
    }
}

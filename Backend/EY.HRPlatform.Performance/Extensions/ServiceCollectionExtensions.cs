using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Audit;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Features.Population;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Identity;
using EY.HRPlatform.Performance.Infrastructure.Evidence;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace EY.HRPlatform.Performance.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddPerformanceApplication(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblyContaining<Program>());
        services.AddHttpContextAccessor();
        services.AddMemoryCache();

        services.AddScoped<IPerformanceAccessPolicyService, PerformanceAccessPolicyService>();
        services.AddScoped<PerformanceViewer>();
        services.AddScoped<IPerformanceAudit, PerformanceAudit>();
        services.Configure<PerformanceNotificationOptions>(configuration.GetSection("Notifications"));
        services.AddScoped<IPerformanceNotifications, PerformanceNotifications>();
        services.AddScoped<IPerformanceNotificationSender, SmtpPerformanceNotificationSender>();
        services.AddScoped<PerformanceNotificationDispatcher>();
        services.AddSingleton<EvidenceUploadSweeper>();
        services.AddSingleton<PerformanceNotificationRetention>();
        services.AddHostedService<PerformanceBackgroundWorker>();
        services.AddScoped<PopulationResolutionService>();

        if (!environment.IsDevelopment() && !environment.IsEnvironment("Testing"))
            throw new InvalidOperationException("Performance evidence requires a production IPerformanceEvidenceStore. The local filesystem store is Development-only.");

        // Local evidence storage is for Development and the isolated test host; production requires a private shared provider.
        var evidenceRoot = configuration["Evidence:LocalRootPath"];
        if (string.IsNullOrWhiteSpace(evidenceRoot))
            evidenceRoot = Path.Combine(AppContext.BaseDirectory, "evidence-store");
        services.AddScoped<IPerformanceEvidenceStore>(sp =>
            new LocalPerformanceEvidenceStore(sp.GetRequiredService<ITenantContext>(), evidenceRoot));

        var internalAuth = configuration
            .GetSection(InternalServiceAuthenticationOptions.SectionName)
            .Get<InternalServiceAuthenticationOptions>() ?? new InternalServiceAuthenticationOptions();
        services.AddSingleton<IInternalServiceRequestSigner>(_ => new InternalServiceRequestSigner(internalAuth));

        services.AddHttpClient<ICoreWorkforceClient, CoreWorkforceClient>(client =>
        {
            var baseUrl = configuration["ServiceUrls:CoreHRApiBaseUrl"];
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                throw new InvalidOperationException(
                    "ServiceUrls:CoreHRApiBaseUrl is not configured. Set it via environment variable or appsettings.");
            }

            client.Timeout = TimeSpan.FromSeconds(10);
            client.BaseAddress = new Uri(baseUrl.EndsWith('/') ? baseUrl : $"{baseUrl}/");
        });

        services.AddHttpClient<IPermissionHoldersClient, PermissionHoldersClient>(client =>
        {
            var baseUrl = configuration["ServiceUrls:IdentityApiBaseUrl"];
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                throw new InvalidOperationException(
                    "ServiceUrls:IdentityApiBaseUrl is not configured. Set it via environment variable or appsettings.");
            }

            client.Timeout = TimeSpan.FromSeconds(10);
            client.BaseAddress = new Uri(baseUrl.EndsWith('/') ? baseUrl : $"{baseUrl}/");
        });

        return services;
    }

    public static IServiceCollection AddPerformanceMultitenancy(this IServiceCollection services)
    {
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
        services.AddScoped<TenantSaveChangesInterceptor>();
        services.AddScoped<AuditAppendOnlyInterceptor>();
        return services;
    }

    public static IServiceCollection AddPerformancePersistence(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("PerformanceDb");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("ConnectionStrings:PerformanceDb is not configured. Set it via environment variable or appsettings.");

        services.AddDbContext<PerformanceDbContext>((sp, options) =>
        {
            options.UseNpgsql(
                connectionString,
                npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "performance"));

            var tenantInterceptor = sp.GetService<TenantSaveChangesInterceptor>()
                ?? throw new InvalidOperationException(
                    "TenantSaveChangesInterceptor is not registered. Ensure AddPerformanceMultitenancy() is called.");
            options.AddInterceptors(tenantInterceptor, sp.GetRequiredService<AuditAppendOnlyInterceptor>());
        });

        services.AddHealthChecks()
            .AddDbContextCheck<PerformanceDbContext>(name: "performance-db", tags: ["ready"]);

        return services;
    }
}

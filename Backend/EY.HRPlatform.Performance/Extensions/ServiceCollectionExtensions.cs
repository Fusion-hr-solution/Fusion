using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Infrastructure.Attachments;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Features.EmployeeObjectives;
using EY.HRPlatform.Performance.Features.Exceptions.Services;
using EY.HRPlatform.Performance.Features.PlanApprovals;
using EY.HRPlatform.Performance.Features.PlanningCompletion;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Jobs;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Security;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddPerformanceApplication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Register MediatR - scans this assembly for all command/query handlers.
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblyContaining<Program>());
        services.AddHttpContextAccessor();
        services.AddMemoryCache();

        services.Configure<ReminderOptions>(configuration.GetSection(ReminderOptions.SectionName));
        var internalServiceAuthentication = configuration
            .GetSection(InternalServiceAuthenticationOptions.SectionName)
            .Get<InternalServiceAuthenticationOptions>() ?? new InternalServiceAuthenticationOptions();
        services.AddSingleton<IInternalServiceRequestSigner>(_ => new InternalServiceRequestSigner(
            internalServiceAuthentication));
        services.AddSingleton<IInternalServiceRequestAuthorizer>(sp => new InternalServiceRequestAuthorizer(
            sp.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>(),
            internalServiceAuthentication));

        services.AddScoped<IPerformanceAccessPolicyService, PerformanceAccessPolicyService>();
        services.AddScoped<EmployeeObjectivePlanAccessGuard>();
        services.AddScoped<PlanApprovalAccessGuard>();
        services.AddScoped<PlanningCompletionReadService>();
        services.AddScoped<IConfigurationAuditWriter, ConfigurationAuditWriter>();
        services.AddScoped<IActivityLog, ActivityLogWriter>();
        services.AddScoped<IActivityLogReader, ActivityLogReader>();
        services.AddScoped<Features.Notifications.IPerformanceNotifier, Features.Notifications.PerformanceNotifier>();

        // Attachments: metadata service + filesystem-backed storage.
        services.Configure<AttachmentOptions>(configuration.GetSection(AttachmentOptions.SectionName));
        services.AddScoped<Features.Attachments.IAttachmentService, Features.Attachments.AttachmentService>();
        services.AddScoped<Features.Attachments.IAttachmentOwnerAuthorization, Features.Attachments.AttachmentOwnerAuthorization>();
        services.AddSingleton<IAttachmentStorage, FileSystemAttachmentStorage>();
        services.AddScoped<PerformanceConfigurationValidator>();
        services.AddScoped<ICurrentUserContext, CurrentUserContext>();
        services.AddScoped<IPerformancePopulationResolver, PerformancePopulationResolver>();
        services.AddScoped<ICampaignReadinessResolver, CampaignReadinessResolver>();
        services.AddScoped<IExceptionCaseWorkflowService, ExceptionCaseWorkflowService>();

        services.AddTransient<BearerTokenForwardingHandler>();
        services.AddHttpClient<ICoreWorkforceClient, CoreWorkforceClient>(client =>
        {
            var baseUrl = configuration["ServiceUrls:CoreApiBaseUrl"];
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                throw new InvalidOperationException(
                    "ServiceUrls:CoreApiBaseUrl is not configured. Set it via environment variable or appsettings.");
            }

            client.BaseAddress = new Uri(EnsureTrailingSlash(baseUrl));
        }).AddHttpMessageHandler<BearerTokenForwardingHandler>();

        // Background job runner: advisory-locked, observable, tenant-safe sweeps.
        services.Configure<ScheduledJobsOptions>(configuration.GetSection(ScheduledJobsOptions.SectionName));
        services.AddSingleton<IAdvisoryLock, PostgresAdvisoryLock>();
        services.AddSingleton<IScheduledJob, DeadlineReminderJob>();
        services.AddSingleton<IScheduledJob, InactivitySweepJob>();
        services.AddSingleton<IScheduledJob, AttachmentCleanupJob>();
        services.AddHostedService<ScheduledJobRunner>();

        return services;
    }

    private static string EnsureTrailingSlash(string url)
        => url.EndsWith('/') ? url : $"{url}/";

    public static IServiceCollection AddMultitenancy(this IServiceCollection services)
    {
        // TenantContext is scoped - one instance per request.
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

        // Interceptor validates tenant context on SaveChanges.
        services.AddScoped<TenantSaveChangesInterceptor>();

        // Interceptor dispatches aggregate domain events after a successful commit.
        services.AddScoped<DomainEventDispatchInterceptor>();

        return services;
    }

    public static IServiceCollection AddPerformancePersistence(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("PerformanceDb");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException(
                "ConnectionStrings:PerformanceDb is not configured. Set it via environment variable or appsettings.");

        services.AddDbContext<PerformanceDbContext>((sp, options) =>
        {
            options.UseNpgsql(
                connectionString,
                npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "performance"));

            var tenantInterceptor = sp.GetService<TenantSaveChangesInterceptor>();
            if (tenantInterceptor is null)
            {
                throw new InvalidOperationException(
                    "TenantSaveChangesInterceptor is not registered. Ensure AddMultitenancy() is called to register multitenancy services.");
            }
            options.AddInterceptors(tenantInterceptor);

            var dispatchInterceptor = sp.GetService<DomainEventDispatchInterceptor>();
            if (dispatchInterceptor is null)
            {
                throw new InvalidOperationException(
                    "DomainEventDispatchInterceptor is not registered. Ensure AddMultitenancy() is called to register multitenancy services.");
            }
            options.AddInterceptors(dispatchInterceptor);
        });

        services.AddHealthChecks()
            .AddDbContextCheck<PerformanceDbContext>(
                name: "performance-db",
                tags: ["ready"]);

        return services;
    }
}

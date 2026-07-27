using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Infrastructure.Attachments;
using EY.HRPlatform.Performance.Features.ObjectivePolicy;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Features.EmployeeObjectives;
using EY.HRPlatform.Performance.Features.Evaluations.Rounds.Services;
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
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining<Program>();

            // A Core HR outage becomes a recoverable failure result for every handler, so no
            // caller can be handed a partial result built on an incomplete workforce read.
            cfg.AddOpenBehavior(typeof(CoreDependencyFailureBehavior<,>));

            // A closed campaign is a read-only archive: reject campaign-scoped writes before the
            // handler runs, rather than trusting ~40 handlers to each check the status.
            cfg.AddOpenBehavior(typeof(Features.Shared.ClosedCampaignWriteBehavior<,>));
        });

        services.AddScoped<Features.Shared.CampaignWriteGuard>();
        services.AddScoped<Features.Cycles.Services.CampaignClosureEligibilityResolver>();
        services.AddScoped<Features.Cycles.Services.CampaignCloser>();
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
        services.AddScoped<Features.CheckIns.CheckInAccessGuard>();
        services.AddScoped<PlanningCompletionReadService>();
        services.AddScoped<Features.Progress.EffectiveReviewerResolver>();
        services.AddScoped<Features.Progress.Queries.ObjectiveProgressHistoryReader>();
        services.AddScoped<IConfigurationAuditWriter, ConfigurationAuditWriter>();
        services.AddScoped<IActivityLog, ActivityLogWriter>();
        services.AddScoped<IActivityLogReader, ActivityLogReader>();
        services.AddScoped<Features.Notifications.IPerformanceNotifier, Features.Notifications.PerformanceNotifier>();

        // Attachments: metadata service + filesystem-backed storage.
        services.Configure<AttachmentOptions>(configuration.GetSection(AttachmentOptions.SectionName));
        services.AddScoped<Features.Attachments.IAttachmentService, Features.Attachments.AttachmentService>();
        services.AddScoped<Features.Attachments.IAttachmentOwnerAuthorization, Features.Attachments.AttachmentOwnerAuthorization>();
        // Storage backend is a configuration choice (D11): filesystem for local development,
        // database when the module runs on more than one replica.
        var attachmentOptions = configuration
            .GetSection(AttachmentOptions.SectionName)
            .Get<AttachmentOptions>() ?? new AttachmentOptions();

        if (attachmentOptions.StorageBackend == AttachmentStorageBackend.Database)
        {
            // Scoped, not singleton: it reads and writes through the request's DbContext.
            services.AddScoped<IAttachmentStorage, PostgresAttachmentStorage>();
        }
        else
        {
            services.AddSingleton<IAttachmentStorage, FileSystemAttachmentStorage>();
        }
        services.AddScoped<PerformanceConfigurationValidator>();
        services.AddScoped<ICurrentUserContext, CurrentUserContext>();
        services.AddScoped<IPerformancePopulationResolver, PerformancePopulationResolver>();
        services.AddScoped<ICampaignReadinessResolver, CampaignReadinessResolver>();
        services.AddScoped<IEvaluationRoundReadinessResolver, EvaluationRoundReadinessResolver>();

        // Core HR client: two resilience policies (D9). Interactive is short and retried; bulk is
        // long and never retried, so a struggling Core is not asked twice for a full-workforce
        // resolve. Both bind from configuration rather than constants.
        services.AddTransient<BearerTokenForwardingHandler>();
        services.Configure<CoreWorkforceResilienceOptions>(
            configuration.GetSection(CoreWorkforceResilienceOptions.SectionName));
        var workforceResilience = configuration
            .GetSection(CoreWorkforceResilienceOptions.SectionName)
            .Get<CoreWorkforceResilienceOptions>() ?? new CoreWorkforceResilienceOptions();

        AddCoreWorkforceHttpClient(
            services, configuration, CoreWorkforceClientNames.Interactive, workforceResilience.Interactive);
        AddCoreWorkforceHttpClient(
            services, configuration, CoreWorkforceClientNames.Bulk, workforceResilience.Bulk);

        // Unkeyed resolution is the interactive policy; bulk is opt-in at the call sites that
        // resolve a whole workforce.
        services.AddScoped<ICoreWorkforceClient>(
            sp => CreateCoreWorkforceClient(sp, CoreWorkforceClientNames.Interactive));
        services.AddKeyedScoped<ICoreWorkforceClient>(
            CoreWorkforceClientNames.Interactive,
            (sp, _) => CreateCoreWorkforceClient(sp, CoreWorkforceClientNames.Interactive));
        services.AddKeyedScoped<ICoreWorkforceClient>(
            CoreWorkforceClientNames.Bulk,
            (sp, _) => CreateCoreWorkforceClient(sp, CoreWorkforceClientNames.Bulk));

        // Background job runner: advisory-locked, observable, tenant-safe sweeps.
        services.Configure<ScheduledJobsOptions>(configuration.GetSection(ScheduledJobsOptions.SectionName));
        services.AddSingleton<IAdvisoryLock, PostgresAdvisoryLock>();
        services.AddSingleton<IScheduledJob, DeadlineReminderJob>();
        services.AddSingleton<IScheduledJob, InactivitySweepJob>();
        services.AddSingleton<IScheduledJob, AttachmentCleanupJob>();
        services.AddSingleton<IScheduledJob, StaleProgressReminderJob>();
        services.AddSingleton<IScheduledJob, UpcomingCheckInReminderJob>();
        services.AddSingleton<IScheduledJob, OverdueCheckInReminderJob>();
        services.AddSingleton<IScheduledJob, FollowUpActionDueReminderJob>();
        services.AddSingleton<IScheduledJob, EvaluationDeadlineReminderJob>();
        services.AddSingleton<IScheduledJob, CampaignClosureReconciliationJob>();
        services.AddHostedService<ScheduledJobRunner>();

        return services;
    }

    private static string EnsureTrailingSlash(string url)
        => url.EndsWith('/') ? url : $"{url}/";

    /// <summary>
    /// Registers one named Core HR <see cref="HttpClient"/> with its resilience policy. The
    /// resilience handler is added before <see cref="BearerTokenForwardingHandler"/> so the
    /// forwarding handler sits inside the pipeline and re-applies the caller's token on every
    /// attempt, retries included.
    /// </summary>
    internal static void AddCoreWorkforceHttpClient(
        IServiceCollection services,
        IConfiguration configuration,
        string clientName,
        CoreWorkforcePolicyOptions policy)
    {
        services
            .AddHttpClient(clientName, client =>
            {
                var baseUrl = configuration["ServiceUrls:CoreApiBaseUrl"];
                if (string.IsNullOrWhiteSpace(baseUrl))
                {
                    throw new InvalidOperationException(
                        "ServiceUrls:CoreApiBaseUrl is not configured. Set it via environment variable or appsettings.");
                }

                client.BaseAddress = new Uri(EnsureTrailingSlash(baseUrl));

                // The resilience pipeline owns the deadline; the client must not impose the
                // 100-second platform default on top of it.
                client.Timeout = Timeout.InfiniteTimeSpan;
            })
            .AddStandardResilienceHandler(options =>
            {
                options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(policy.AttemptTimeoutSeconds);
                options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(policy.TotalTimeoutSeconds);

                if (policy.MaxRetryAttempts <= 0)
                {
                    // Bulk resolution must not retry: a second full-population resolve doubles
                    // load on an already-struggling Core HR, and launch is not idempotent enough
                    // to want an automatic second attempt.
                    options.Retry.MaxRetryAttempts = 1;
                    options.Retry.ShouldHandle = _ => ValueTask.FromResult(false);
                }
                else
                {
                    options.Retry.MaxRetryAttempts = policy.MaxRetryAttempts;
                    options.Retry.Delay = TimeSpan.FromSeconds(policy.RetryDelaySeconds);
                }

                options.CircuitBreaker.SamplingDuration =
                    TimeSpan.FromSeconds(policy.CircuitBreakerSamplingDurationSeconds);
                options.CircuitBreaker.BreakDuration =
                    TimeSpan.FromSeconds(policy.CircuitBreakerBreakDurationSeconds);
                options.CircuitBreaker.FailureRatio = policy.CircuitBreakerFailureRatio;
                options.CircuitBreaker.MinimumThroughput = policy.CircuitBreakerMinimumThroughput;
            });

        services
            .AddHttpClient(clientName)
            .AddHttpMessageHandler<BearerTokenForwardingHandler>();
    }

    private static ICoreWorkforceClient CreateCoreWorkforceClient(IServiceProvider sp, string clientName)
        => new CoreWorkforceClient(
            sp.GetRequiredService<IHttpClientFactory>().CreateClient(clientName),
            sp.GetRequiredService<IInternalServiceRequestSigner>());

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

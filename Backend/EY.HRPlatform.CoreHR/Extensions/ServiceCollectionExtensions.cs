using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence.Interceptors;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddCoreHRApplication(this IServiceCollection services)
    {
        // Register MediatR - scans this assembly for all command/query handlers
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblyContaining<Program>());

        return services;
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

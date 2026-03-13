using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddCoreHRPersistence(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("CoreHRDb");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("ConnectionStrings:CoreHRDb is not configured. Set it via environment variable or appsettings.");

        services.AddDbContext<CoreHRDbContext>(options =>
            options.UseNpgsql(
                connectionString,
                npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "corehr")));

        services.AddHealthChecks()
            .AddDbContextCheck<CoreHRDbContext>(
                name: "corehr-db",
                tags: ["ready"]);

        return services;
    }
}

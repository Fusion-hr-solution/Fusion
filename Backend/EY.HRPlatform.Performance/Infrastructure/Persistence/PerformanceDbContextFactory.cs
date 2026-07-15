using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence;

public class PerformanceDbContextFactory : IDesignTimeDbContextFactory<PerformanceDbContext>
{
    public PerformanceDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var currentDirectory = Directory.GetCurrentDirectory();

        var candidateBasePaths = new[]
        {
            currentDirectory,
            Path.Combine(currentDirectory, "EY.HRPlatform.Performance"),
            Path.GetFullPath(Path.Combine(currentDirectory, "..", "EY.HRPlatform.Performance"))
        };

        var basePath = candidateBasePaths.FirstOrDefault(path =>
            File.Exists(Path.Combine(path, "appsettings.json"))) ?? currentDirectory;

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true, reloadOnChange: false)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("PerformanceDb");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:PerformanceDb is not configured for design-time DbContext creation.");
        }

        var optionsBuilder = new DbContextOptionsBuilder<PerformanceDbContext>();
        optionsBuilder.UseNpgsql(
            connectionString,
            npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "performance"));

        return new PerformanceDbContext(optionsBuilder.Options);
    }
}

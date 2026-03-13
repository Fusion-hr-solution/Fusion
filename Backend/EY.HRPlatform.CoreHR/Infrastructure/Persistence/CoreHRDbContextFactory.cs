using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence;

public class CoreHRDbContextFactory : IDesignTimeDbContextFactory<CoreHRDbContext>
{
    public CoreHRDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var currentDirectory = Directory.GetCurrentDirectory();

        var candidateBasePaths = new[]
        {
            currentDirectory,
            Path.Combine(currentDirectory, "EY.HRPlatform.CoreHR"),
            Path.GetFullPath(Path.Combine(currentDirectory, "..", "EY.HRPlatform.CoreHR"))
        };

        var basePath = candidateBasePaths.FirstOrDefault(path =>
            File.Exists(Path.Combine(path, "appsettings.json"))) ?? currentDirectory;

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true, reloadOnChange: false)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("CoreHRDb");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:CoreHRDb is not configured for design-time DbContext creation.");
        }

        var optionsBuilder = new DbContextOptionsBuilder<CoreHRDbContext>();
        optionsBuilder.UseNpgsql(
            connectionString,
            npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "corehr"));

        return new CoreHRDbContext(optionsBuilder.Options);
    }
}

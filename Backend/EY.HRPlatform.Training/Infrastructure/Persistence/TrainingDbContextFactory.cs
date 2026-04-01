using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Training.Infrastructure.Persistence;

public class TrainingDbContextFactory : IDesignTimeDbContextFactory<TrainingDbContext>
{
    public TrainingDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var currentDirectory = Directory.GetCurrentDirectory();

        var candidateBasePaths = new[]
        {
            currentDirectory,
            Path.Combine(currentDirectory, "EY.HRPlatform.Training"),
            Path.GetFullPath(Path.Combine(currentDirectory, "..", "EY.HRPlatform.Training"))
        };

        var basePath = candidateBasePaths.FirstOrDefault(path =>
            File.Exists(Path.Combine(path, "appsettings.json"))) ?? currentDirectory;

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true, reloadOnChange: false)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("TrainingDb");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:TrainingDb is not configured for design-time DbContext creation.");
        }

        var optionsBuilder = new DbContextOptionsBuilder<TrainingDbContext>();
        optionsBuilder.UseNpgsql(
            connectionString,
            npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "training"));

        return new TrainingDbContext(optionsBuilder.Options);
    }
}

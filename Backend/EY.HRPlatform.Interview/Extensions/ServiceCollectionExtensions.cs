using EY.HRPlatform.Interview.Features.Questions;
using EY.HRPlatform.Interview.Features.TestQuestions;
using EY.HRPlatform.Interview.Features.Tests;
using EY.HRPlatform.Interview.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EY.HRPlatform.Interview.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInterviewServices(this IServiceCollection services, IConfiguration configuration)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                          ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
                          ?? configuration["ASPNETCORE_ENVIRONMENT"]
                          ?? configuration["DOTNET_ENVIRONMENT"];
        if (!string.IsNullOrWhiteSpace(environment) &&
            string.Equals(environment, "Testing", StringComparison.OrdinalIgnoreCase))
        {
            var inMemoryName = configuration["Database:InMemoryName"] ?? "InterviewTestingDb";
            services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(inMemoryName));
            services.AddScoped<IQuestionService, QuestionService>();
            services.AddScoped<ITestService, TestService>();
            services.AddScoped<ITestQuestionService, TestQuestionService>();
            return services;
        }

        var connectionString = configuration.GetConnectionString("InterviewDb");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("ConnectionStrings:InterviewDb is not configured.");

        services.AddDbContext<AppDbContext>(options =>
           {
            options.UseNpgsql(
                connectionString,
                npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "interview"));
            if (!string.IsNullOrWhiteSpace(environment) &&
                string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase))
            {
                options.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
            }
        });
        services.AddScoped<IQuestionService, QuestionService>();
        services.AddScoped<ITestService, TestService>();
        services.AddScoped<ITestQuestionService, TestQuestionService>();

        return services;
    }
}

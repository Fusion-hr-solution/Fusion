using EY.HRPlatform.Interview.Features.Questions;
using EY.HRPlatform.Interview.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EY.HRPlatform.Interview.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInterviewServices(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("InterviewDb");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("ConnectionStrings:InterviewDb is not configured.");

        services.AddDbContext<AppDbContext>(options =>
           {
            options.UseSqlServer(connectionString);
            var environment = configuration["ASPNETCORE_ENVIRONMENT"];
            if (!string.IsNullOrWhiteSpace(environment) &&
                string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase))
            {
                options.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
            }
        });
        services.AddScoped<IQuestionService, QuestionService>();

        return services;
    }
}

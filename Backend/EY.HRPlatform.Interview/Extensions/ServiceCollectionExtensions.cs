using EY.HRPlatform.Interview.Features.Candidates;
using EY.HRPlatform.Interview.Features.Grading;
using EY.HRPlatform.Interview.Features.Grading.Graders;
using EY.HRPlatform.Interview.Features.Grading.Groq;
using EY.HRPlatform.Interview.Features.Grading.HumanReview;
using EY.HRPlatform.Interview.Features.Grading.Judge0;
using EY.HRPlatform.Interview.Features.Questions;
using EY.HRPlatform.Interview.Features.TestQuestions;
using EY.HRPlatform.Interview.Features.Tests;
using EY.HRPlatform.Interview.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using StackExchange.Redis;

namespace EY.HRPlatform.Interview.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInterviewServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<CandidateInvitationEmailOptions>(configuration.GetSection("CandidateInvitations:Email"));
        services.AddScoped<ICandidateInvitationEmailSender, SmtpCandidateInvitationEmailSender>();

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
            services.AddScoped<ICandidatePrivacyActionExecutor, CandidatePrivacyActionExecutor>();
            services.AddScoped<ICandidateManagementService, CandidateManagementService>();
            services.AddScoped<ICandidateRetentionService, CandidateRetentionService>();
            services.AddScoped<ICandidateInvitationService, CandidateInvitationService>();
            services.AddScoped<ICandidateAccessService, CandidateAccessService>();
            services.AddScoped<IGrader, DeterministicGrader>();
            services.AddScoped<GradingOrchestrator>();
            services.AddScoped<HumanReviewService>();
            services.AddDistributedMemoryCache();
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
        services.AddScoped<ICandidatePrivacyActionExecutor, CandidatePrivacyActionExecutor>();
        services.AddScoped<ICandidateManagementService, CandidateManagementService>();
        services.AddScoped<ICandidateRetentionService, CandidateRetentionService>();
        services.AddScoped<ICandidateInvitationService, CandidateInvitationService>();
        services.AddScoped<ICandidateAccessService, CandidateAccessService>();
        services.AddHostedService<CandidateRetentionBackgroundService>();

        services.AddScoped<IGrader, DeterministicGrader>();
        services.AddScoped<GradingOrchestrator>();
        services.AddScoped<HumanReviewService>();
        services.AddHostedService<GradingBackgroundService>();

        var groqApiKey = configuration["Groq:ApiKey"];
        if (!string.IsNullOrWhiteSpace(groqApiKey))
        {
            services.AddScoped<IGrader, GroqGrader>();
            services.AddHttpClient<GroqClient>(c =>
            {
                c.BaseAddress = new Uri("https://api.groq.com");
                c.DefaultRequestHeaders.Add("Authorization", $"Bearer {groqApiKey}");
            });
        }

        var judge0BaseUrl = configuration["Judge0:BaseUrl"];
        if (!string.IsNullOrWhiteSpace(judge0BaseUrl))
        {
            services.AddScoped<IGrader, Judge0Grader>();
            services.AddHttpClient<Judge0Client>(c =>
            {
                c.BaseAddress = new Uri(judge0BaseUrl);
                var token = configuration["Judge0:AuthToken"];
                if (!string.IsNullOrWhiteSpace(token))
                    c.DefaultRequestHeaders.Add("X-Auth-Token", token);
            });
        }

        var redisConnectionString = configuration["Redis:ConnectionString"];
        if (!string.IsNullOrWhiteSpace(redisConnectionString))
        {
            services.AddStackExchangeRedisCache(o =>
            {
                var opts = ConfigurationOptions.Parse(redisConnectionString);
                // Keep connect attempts short so a missing Redis instance doesn't
                // stall requests. SYN_SENT can hang for the full connectTimeout on
                // Windows when nothing is listening on the port.
                opts.ConnectTimeout = 300;
                opts.SyncTimeout = 300;
                opts.AbortOnConnectFail = true; // fail fast after timeout; subsequent ops throw immediately
                o.ConfigurationOptions = opts;
            });
        }
        else
        {
            services.AddDistributedMemoryCache();
        }

        return services;
    }
}
using EY.HRPlatform.Interview.Features.Candidates;
using EY.HRPlatform.Interview.Features.Grading;
using EY.HRPlatform.Interview.Features.Grading.FrontendRunner;
using EY.HRPlatform.Interview.Features.Grading.Graders;
using EY.HRPlatform.Interview.Features.Grading.Groq;
using EY.HRPlatform.Interview.Features.Grading.HumanReview;
using EY.HRPlatform.Interview.Features.Grading.Judge0;
using EY.HRPlatform.Interview.Features.Questions;
using EY.HRPlatform.Interview.Features.TestQuestions;
using EY.HRPlatform.Interview.Features.Tests;
using EY.HRPlatform.Interview.Infrastructure;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.IdentityModel.Tokens;
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
        var isTesting = !string.IsNullOrWhiteSpace(environment) &&
            string.Equals(environment, "Testing", StringComparison.OrdinalIgnoreCase);

        AddJwtAuthentication(services, configuration, isTesting);

        if (isTesting)
        {
            var inMemoryName = configuration["Database:InMemoryName"] ?? "InterviewTestingDb";
            services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(inMemoryName));
            services.AddScoped<IQuestionService, QuestionService>();
            services.AddScoped<IQuestionGeneratorService, QuestionGeneratorService>();
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
            services.AddSingleton<ICodeRunThrottle, CodeRunThrottle>();
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
        services.AddScoped<IQuestionGeneratorService, QuestionGeneratorService>();
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
            services.Configure<GroqGradingOptions>(configuration.GetSection(GroqGradingOptions.SectionName));
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

        // Frontend Project auto-grading runs the candidate's app against the author's hidden tests in
        // a sandboxed runner. Registered only when explicitly enabled + images are configured;
        // otherwise Frontend Project questions fall through to human review.
        if (configuration.GetValue($"{FrontendRunnerOptions.SectionName}:Enabled", false))
        {
            services.Configure<FrontendRunnerOptions>(configuration.GetSection(FrontendRunnerOptions.SectionName));
            services.AddScoped<IFrontendProjectRunner, DockerFrontendProjectRunner>();
            services.AddScoped<IGrader, FrontendProjectGrader>();
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

            // Shared multiplexer for cross-replica coordination (the code-run throttle).
            // Connect lazily and don't abort on connect failure so a Redis blip can't
            // block startup; the throttle fails open to its in-process fallback instead.
            services.AddSingleton<IConnectionMultiplexer>(_ =>
            {
                var muxOpts = ConfigurationOptions.Parse(redisConnectionString);
                muxOpts.AbortOnConnectFail = false;
                return ConnectionMultiplexer.Connect(muxOpts);
            });
        }
        else
        {
            services.AddDistributedMemoryCache();
        }

        // Backpressure + rate limiting for the candidate code-run endpoint. Resolves the
        // optional IConnectionMultiplexer when Redis is configured; otherwise uses its
        // in-process fallback.
        services.AddSingleton<ICodeRunThrottle, CodeRunThrottle>();

        return services;
    }

    /// <summary>
    /// Registers JWT bearer authentication so protected endpoints can trust the
    /// caller identity from the Identity-issued token instead of request bodies.
    /// Must use the same signing secret / issuer / audience as the Identity service.
    /// </summary>
    private static void AddJwtAuthentication(IServiceCollection services, IConfiguration configuration, bool isTesting)
    {
        var jwtSecret = configuration["Jwt:Secret"];
        if (string.IsNullOrWhiteSpace(jwtSecret))
        {
            if (!isTesting)
                throw new InvalidOperationException("Jwt:Secret is not configured.");

            // Integration tests boot the full pipeline; this dummy key lets the scheme register
            // without real secrets. Tests that call protected routes mint a token against it.
            jwtSecret = TestingSigningKey;
        }

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = configuration["Jwt:Issuer"],
                ValidAudience = configuration["Jwt:Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                ClockSkew = TimeSpan.Zero
            };
        });

        // SECURE BY DEFAULT. Without a fallback policy, any endpoint lacking [Authorize] is
        // anonymous — which left the whole authoring/admin surface open (questions incl. their
        // TestCases + hidden FrontendTestFiles answer keys, tests, invitations with candidate
        // emails, GDPR privacy actions, retention, link-security). Requiring an authenticated
        // caller by default means a new endpoint is protected unless it *explicitly* opts out with
        // [AllowAnonymous] — which only the token-gated candidate surface does
        // (CandidateAccessController).
        services.AddAuthorization(options =>
        {
            options.FallbackPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();
        });
    }

    /// <summary>Signing key used only when the Testing environment supplies no Jwt:Secret.
    /// Integration tests mint bearer tokens against it to exercise protected routes.</summary>
    internal const string TestingSigningKey = "interview-testing-signing-key-not-used-0123456789";
}
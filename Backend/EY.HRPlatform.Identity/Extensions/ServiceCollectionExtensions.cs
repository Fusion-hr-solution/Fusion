using System.Diagnostics;
using System.Text;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.PlatformOrganizations.Services;
using EY.HRPlatform.Identity.Features.Tenants.Services;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Infrastructure.Services;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace EY.HRPlatform.Identity.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddMultitenancy(this IServiceCollection services)
    {
        // TenantContext is scoped - one instance per request
        // Register concrete type first, then interface pointing to same instance
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

        // Note: Unlike CoreHR, Identity does NOT wire TenantSaveChangesInterceptor in DI.
        // Identity inherently performs cross-tenant writes (PlatformAdmin creates orgs/invites/users
        // for other tenants, IdentitySeeder runs at startup with no request context).
        // Write authorization is enforced at the controller/service layer instead.
        // The interceptor class is kept for explicit opt-in in unit tests.

        return services;
    }

    public static IServiceCollection AddIdentityServices(
        this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSecret = configuration["Jwt:Secret"];
        if (string.IsNullOrEmpty(jwtSecret))
            throw new InvalidOperationException("Jwt:Secret is not configured. Set it via environment variable or appsettings.");

        var databaseProvider = configuration["Database:Provider"] ?? "postgres";
        var inMemoryName = configuration["Database:InMemoryName"] ?? "identity_inmemory";

        // 1. Register database
        if (databaseProvider.Equals("inmemory", StringComparison.OrdinalIgnoreCase))
        {
            services.AddDbContext<AppIdentityDbContext>((sp, options) =>
            {
                options.UseInMemoryDatabase(inMemoryName);
            });
        }
        else
        {
            var connectionString = configuration.GetConnectionString("IdentityDb");
            if (string.IsNullOrEmpty(connectionString))
                throw new InvalidOperationException(
                    "ConnectionStrings:IdentityDb is not configured. Set it via environment variable or appsettings.");

            // PostgreSQL database
            services.AddDbContext<AppIdentityDbContext>((sp, options) =>
            {
                options.UseNpgsql(
                    connectionString,
                    npgsql => npgsql.MigrationsHistoryTable(
                        "__EFMigrationsHistory", "identity"));
            });
        }

        // 2. Register ASP.NET Core Identity
        services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
        {
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireNonAlphanumeric = true;
            options.Password.RequiredLength = 8;
            options.User.RequireUniqueEmail = true;
        })
            .AddEntityFrameworkStores<AppIdentityDbContext>()
            .AddDefaultTokenProviders();

        // 3. Register JWT authentication
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
                    IssuerSigningKey = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(jwtSecret)),
                    ClockSkew = TimeSpan.Zero
                };
            });

        // 4. Register our custom services
        services.AddSingleton<IInvitationLinkBuilder, InvitationLinkBuilder>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<ITenantService, TenantService>();
        services.AddScoped<IPlatformOrganizationService, PlatformOrganizationService>();

        services.Configure<WorkforceInvitationEmailOptions>(
            configuration.GetSection(WorkforceInvitationEmailOptions.SectionName));

        // 5. Training service client (service-to-service)
        // This integration is fire-and-forget only. When local config is blank,
        // keep Identity endpoints working and skip downstream provisioning.
        var trainingBaseUrl = configuration["Services:TrainingUrl"]?.Trim();
        var serviceApiKey = configuration["ServiceIntegration:ApiKey"]?.Trim();

        if (string.IsNullOrWhiteSpace(trainingBaseUrl) || string.IsNullOrWhiteSpace(serviceApiKey))
        {
            services.AddSingleton<ITrainingServiceClient, NoOpTrainingServiceClient>();
        }
        else
        {
            services.AddHttpClient<ITrainingServiceClient, HttpTrainingServiceClient>(client =>
            {
                client.BaseAddress = new Uri(trainingBaseUrl);
                client.DefaultRequestHeaders.Add("X-Service-Key", serviceApiKey);
                client.Timeout = TimeSpan.FromSeconds(5);
            });
        }

        var invitationEmailEnabled = configuration.GetValue<bool>($"{WorkforceInvitationEmailOptions.SectionName}:Enabled");
        var invitationSmtpHost = configuration[$"{WorkforceInvitationEmailOptions.SectionName}:SmtpHost"]?.Trim();

        if (!invitationEmailEnabled || string.IsNullOrWhiteSpace(invitationSmtpHost))
        {
            services.AddSingleton<IWorkforceInvitationEmailSender, NoOpWorkforceInvitationEmailSender>();
        }
        else
        {
            services.AddSingleton<IWorkforceInvitationEmailSender, SmtpWorkforceInvitationEmailSender>();
        }

        return services;
    }
}
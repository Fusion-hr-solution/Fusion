using System.Text;
using EY.HRPlatform.Training.Features.Admin.Sessions.Export;
using EY.HRPlatform.Training.Features.Admin.Sessions.Services;
using EY.HRPlatform.Training.Features.Calendar.Feed;
using EY.HRPlatform.Training.Features.Calendar.Ics;
using EY.HRPlatform.Training.Features.Calendar.Invites;
using EY.HRPlatform.Training.Features.Calendar.Sync;
using EY.HRPlatform.Training.Features.Certifications.Export;
using EY.HRPlatform.Training.Features.Certifications.Services;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace EY.HRPlatform.Training.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddTrainingServices(
        this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSecret = configuration["Jwt:Secret"];
        if (string.IsNullOrEmpty(jwtSecret))
            throw new InvalidOperationException("Jwt:Secret is not configured.");

        var connectionString = configuration.GetConnectionString("TrainingDb");
        if (string.IsNullOrEmpty(connectionString))
            throw new InvalidOperationException("ConnectionStrings:TrainingDb is not configured.");

        // 1. Register PostgreSQL database
        services.AddDbContext<TrainingDbContext>(options =>
            options.UseNpgsql(
                connectionString,
                npgsql => npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "training")));

        // 2. Register JWT authentication
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

        // 3. Register MediatR — scans this assembly for all handlers
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblyContaining<Program>());

        // 4. Register export service (Excel + PDF participant lists)
        services.AddSingleton<ISessionParticipantExporter, SessionParticipantExporter>();

        // 5. Register QR token service (rotating HMAC payloads for session attendance)
        services.AddSingleton<IQrTokenService, QrTokenService>();

        // 6. Register certificate services (number/QR/PDF/URL are stateless singletons; issuance is scoped)
        services.AddSingleton<ICertificateNumberGenerator, CertificateNumberGenerator>();
        services.AddSingleton<ICertificateQrService, CertificateQrService>();
        services.AddSingleton<ICertificatePdfService, CertificatePdfService>();
        services.AddSingleton<ICertificateUrlBuilder, CertificateUrlBuilder>();
        services.AddSingleton<ICertificateRegistryExporter, CertificateRegistryExporter>();
        services.AddScoped<ICertificateIssuanceService, CertificateIssuanceService>();

        // 7. Register calendar feed services (ICS builder + feed-token hashing — stateless singletons)
        services.AddSingleton<ICalendarFeedService, IcsCalendarFeed>();
        services.AddSingleton<ICalendarFeedTokenService, CalendarFeedTokenService>();

        // 8. Calendar session-sync (invites). Provider from config (Imip | Graph | None); falls back to
        //    NoOp when iMIP isn't configured. Graph is a future adapter (seam ready, not yet implemented).
        services.AddSingleton<IcsInviteBuilder>();
        var calendarEmailSection = configuration.GetSection(CalendarEmailOptions.SectionName);
        services.Configure<CalendarEmailOptions>(calendarEmailSection);

        var inviteProvider = configuration["Calendar:InviteProvider"];
        var imipEnabled = string.Equals(calendarEmailSection["Enabled"], "true", StringComparison.OrdinalIgnoreCase);
        var imipHost = calendarEmailSection["SmtpHost"]?.Trim();
        var useImip =
            (string.IsNullOrWhiteSpace(inviteProvider) || inviteProvider.Equals("Imip", StringComparison.OrdinalIgnoreCase))
            && imipEnabled
            && !string.IsNullOrWhiteSpace(imipHost);

        if (useImip)
            services.AddSingleton<ISessionInviteSync, ImipEmailInviteSync>();
        else
            services.AddSingleton<ISessionInviteSync, NoOpInviteSync>();

        services.AddScoped<CalendarSyncProcessor>();
        services.AddHostedService<CalendarBackgroundService>();

        return services;
    }
}

using System.Text;
using EY.HRPlatform.Training.Features.Admin.Sessions.Export;
using EY.HRPlatform.Training.Features.Admin.Sessions.Services;
using EY.HRPlatform.Training.Features.Certifications.Export;
using EY.HRPlatform.Training.Features.Certifications.Services;
using EY.HRPlatform.Training.Features.Enrollment.Services;
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

        // 7. Register on-site completion materialisation (ADR 0005) — scoped, uses the DbContext
        services.AddScoped<IAttendanceCompletionService, AttendanceCompletionService>();

        return services;
    }
}

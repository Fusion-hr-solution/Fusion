using System.Net.Http.Headers;
using System.Text;
using EY.HRPlatform.Training.Features.Admin.Import;
using EY.HRPlatform.Training.Features.Admin.Quiz;
using EY.HRPlatform.Training.Features.Admin.Reports.Export;
using EY.HRPlatform.Training.Features.Admin.Budget;
using EY.HRPlatform.Training.Features.Admin.Budget.Export;
using EY.HRPlatform.Training.Features.Admin.Sessions.Export;
using EY.HRPlatform.Training.Features.Admin.Sessions.Services;
using EY.HRPlatform.Training.Features.Calendar.Feed;
using EY.HRPlatform.Training.Features.Calendar.Ics;
using EY.HRPlatform.Training.Features.Calendar.Invites;
using EY.HRPlatform.Training.Features.Calendar.Reminders;
using EY.HRPlatform.Training.Features.Calendar.Sync;
using EY.HRPlatform.Training.Features.Certifications.Export;
using EY.HRPlatform.Training.Features.Certifications.Services;
using EY.HRPlatform.Training.Features.Enrollment.Services;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Infrastructure.Services;
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

        // 4b. Register report exporter (US-8.2.1/8.2.2 Excel reports)
        services.AddSingleton<IReportExporter, ReportExporter>();

        // 4c. Register training import template generator (US-8.2.4)
        services.AddSingleton<ITrainingImportTemplateGenerator, TrainingImportTemplateGenerator>();

        // 4c-bis. PDF text extraction — stores uploaded-PDF text into ContentBlock.TextContent (US-8.2.5)
        // so the AI quiz generator (and future search) can read it from the DB.
        services.AddSingleton<EY.HRPlatform.Training.Features.Admin.Content.IPdfTextExtractor,
            EY.HRPlatform.Training.Features.Admin.Content.PdfTextExtractor>();

        // 4d. Register the AI quiz client (opencode GO) only when it's configured (US-8.2.5, ADR 0009).
        // Without it, AI quiz generation is disabled (the endpoint returns 503). BaseUrl is origin-only
        // (e.g. https://opencode.ai); Path/Model default to opencode GO's "zen go" endpoint and a DeepSeek model.
        var openCodeBaseUrl = configuration["Training:OpenCode:BaseUrl"];
        var openCodeApiKey = configuration["Training:OpenCode:ApiKey"];
        if (!string.IsNullOrWhiteSpace(openCodeBaseUrl) && !string.IsNullOrWhiteSpace(openCodeApiKey))
        {
            services.AddSingleton(new OpenCodeGoOptions
            {
                BaseUrl = openCodeBaseUrl,
                ApiKey = openCodeApiKey,
                Model = configuration["Training:OpenCode:Model"] ?? "glm-5.2",
                Path = configuration["Training:OpenCode:Path"] ?? "/zen/go/v1/chat/completions",
            });
            services.AddHttpClient<ILlmClient, OpenCodeGoLlmClient>(client =>
            {
                client.BaseAddress = new Uri(openCodeBaseUrl);
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", openCodeApiKey);
                client.Timeout = TimeSpan.FromSeconds(120);
            });
        }

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

        // Reminders reuse the same SMTP config (Email:Calendar), independent of the invite provider.
        var emailConfigured = imipEnabled && !string.IsNullOrWhiteSpace(imipHost);
        if (emailConfigured)
            services.AddSingleton<IReminderEmailSender, SmtpReminderEmailSender>();
        else
            services.AddSingleton<IReminderEmailSender, NoOpReminderEmailSender>();

        services.AddScoped<CalendarSyncProcessor>();
        services.AddScoped<ReminderScanner>();
        services.AddHostedService<CalendarBackgroundService>();

        // 9. Register on-site completion materialisation (ADR 0005) — scoped, uses the DbContext
        services.AddScoped<IAttendanceCompletionService, AttendanceCompletionService>();

        // 10. Budget alert email sender (own SMTP infra; Smtp when enabled + configured, else NoOp)
        var budgetAlertSection = configuration.GetSection(BudgetAlertEmailOptions.SectionName);
        services.Configure<BudgetAlertEmailOptions>(budgetAlertSection);

        var budgetAlertEnabled = string.Equals(budgetAlertSection["Enabled"], "true", StringComparison.OrdinalIgnoreCase);
        var budgetAlertSmtpHost = budgetAlertSection["SmtpHost"]?.Trim();

        if (!budgetAlertEnabled || string.IsNullOrWhiteSpace(budgetAlertSmtpHost))
            services.AddSingleton<IBudgetAlertEmailSender, NoBudgetAlertEmailSender>();
        else
            services.AddSingleton<IBudgetAlertEmailSender, SmtpBudgetAlertEmailSender>();

        // 11. Budget threshold notifier (scoped — uses the scoped DbContext)
        services.AddScoped<IBudgetAlertNotifier, BudgetAlertNotifier>();

        // 12. Budget report exporter (Excel + PDF)
        services.AddSingleton<IBudgetReportExporter, BudgetReportExporter>();

        return services;
    }
}

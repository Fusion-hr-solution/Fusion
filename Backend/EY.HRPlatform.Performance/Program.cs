using System.Text;
using System.Text.Json.Serialization;
using EY.HRPlatform.Performance.Extensions;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Middleware;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Metrics;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration));

var jwtSecret = builder.Configuration["Jwt:Secret"];
if (string.IsNullOrEmpty(jwtSecret))
    throw new InvalidOperationException("Jwt:Secret is not configured. Set it via environment variable or appsettings.");

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddMultitenancy();
builder.Services.AddPerformanceApplication(builder.Configuration);
builder.Services.AddPerformancePersistence(builder.Configuration);

builder.Services.AddOpenTelemetry()
    .WithMetrics(metrics =>
    {
        metrics.AddAspNetCoreInstrumentation();
        metrics.AddPrometheusExporter();
    });

var app = builder.Build();

if (builder.Configuration.GetValue<bool>("Database:AutoMigrate"))
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
    await dbContext.Database.MigrateAsync();
    await PlatformDefaultsSeeder.SeedAsync(dbContext);

    if (app.Environment.IsDevelopment() &&
        builder.Configuration.GetValue<bool>("DemoSeed:AtlasPerformance:Enabled"))
    {
        var tenantValue = builder.Configuration["DemoSeed:AtlasPerformance:TenantId"];
        if (!Guid.TryParse(tenantValue, out var atlasTenantId) || atlasTenantId == Guid.Empty)
            throw new InvalidOperationException(
                "DemoSeed:AtlasPerformance:TenantId must be a non-empty GUID when the Atlas seed is enabled.");
        await AtlasPerformanceDemoSeeder.SeedAsync(dbContext, atlasTenantId, DateTime.UtcNow);
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger(c => c.RouteTemplate = "api/performance/swagger/{documentName}/swagger.json");
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("v1/swagger.json", "Performance API v1");
        c.RoutePrefix = "api/performance/swagger";
    });
}

app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
app.UseSerilogRequestLogging(options =>
{
    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
    {
        var correlationId = httpContext.Request.Headers["X-Correlation-Id"].FirstOrDefault()
            ?? httpContext.TraceIdentifier;
        diagnosticContext.Set("CorrelationId", correlationId);
        diagnosticContext.Set("UserId", httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value);

        var tenantContext = httpContext.RequestServices.GetService<ITenantContext>();
        diagnosticContext.Set("TenantId", tenantContext?.TenantIdOrDefault?.ToString());
    };
});

app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>(); // after auth (claims populated), resolves tenant from claim/header
app.UseMiddleware<LogContextEnrichmentMiddleware>(); // enriches logs with correlation/user/tenant
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") }).AllowAnonymous();
app.MapPrometheusScrapingEndpoint("/metrics").AllowAnonymous();

app.Run();

// Exposed for integration testing (WebApplicationFactory).
public partial class Program;

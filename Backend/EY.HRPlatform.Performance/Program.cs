using System.Text;
using System.Text.Json.Serialization;
using EY.HRPlatform.DemoSeed;
using EY.HRPlatform.Performance.Extensions;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Middleware;
using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
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
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        // Model binding is a failure source like any other: it must emit the same problem shape,
        // with a code and correlation id, rather than the framework's bare validation payload.
        options.InvalidModelStateResponseFactory = context =>
        {
            var fieldErrors = context.ModelState
                .Where(entry => entry.Value?.Errors.Count > 0)
                .ToDictionary(
                    entry => entry.Key,
                    entry => entry.Value!.Errors.Select(error => error.ErrorMessage).ToArray());

            return PerformanceProblem.Create(
                context.HttpContext,
                StatusCodes.Status400BadRequest,
                "Performance.Invalid",
                "The request could not be read. Check the highlighted fields.",
                fieldErrors);
        };
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
builder.Services.AddPerformanceRateLimiting(builder.Configuration);

builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(
        serviceName: "ey-hrplatform-performance",
        serviceVersion: typeof(Program).Assembly.GetName().Version?.ToString()))
    .WithMetrics(metrics =>
    {
        metrics.AddAspNetCoreInstrumentation();
        metrics.AddPrometheusExporter();
    })
    .WithTracing(tracing =>
    {
        // Inbound requests, outbound Core HR calls, and database work on one trace, so a slow
        // campaign launch can be attributed to the dependency or to the query that caused it.
        tracing.AddAspNetCoreInstrumentation();
        tracing.AddHttpClientInstrumentation();
        tracing.AddEntityFrameworkCoreInstrumentation();
    });

var app = builder.Build();

if (builder.Configuration.GetValue<bool>("Database:AutoMigrate"))
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
    await dbContext.Database.MigrateAsync();
    await PlatformDefaultsSeeder.SeedAsync(dbContext);

    var legacyDemoSeedEnabled = builder.Configuration.GetValue<bool>("DemoSeed:AtlasPerformance:Enabled");
    var canonicalSeedEnabled = builder.Configuration.GetValue<bool>("DemoSeed:Canonical:Enabled");
    var resetCanonicalTenant = builder.Configuration.GetValue<bool>("DemoSeed:Canonical:Reset");
    if (app.Environment.IsDevelopment() && legacyDemoSeedEnabled && !canonicalSeedEnabled)
        throw new InvalidOperationException(
            "DemoSeed:AtlasPerformance is retired. Use DemoSeed:Canonical:Enabled=true and scripts/fusion-demo.ps1.");

    if (app.Environment.IsDevelopment() && canonicalSeedEnabled)
    {
        var tenantValue = builder.Configuration["DemoSeed:Canonical:TenantId"];
        var canonicalTenantId = Guid.TryParse(tenantValue, out var configuredTenantId)
            ? configuredTenantId
            : CanonicalDemoSeed.TenantId;
        if (canonicalTenantId != CanonicalDemoSeed.TenantId)
            throw new InvalidOperationException("DemoSeed:Canonical:TenantId must match the canonical manifest tenant.");
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(canonicalTenantId);
        if (resetCanonicalTenant)
        {
            if (!app.Environment.IsDevelopment())
                throw new InvalidOperationException("Canonical tenant reset is Development-only.");
            await AtlasPerformanceDemoSeeder.ResetAsync(dbContext, canonicalTenantId);
        }
        await AtlasPerformanceDemoSeeder.SeedAsync(dbContext, canonicalTenantId, CanonicalDemoSeed.AsOfUtc);
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
// After auth and tenant resolution, so the limiter partitions on a resolved caller.
app.UseRateLimiter();
app.MapControllers();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") }).AllowAnonymous();
app.MapPrometheusScrapingEndpoint("/metrics").AllowAnonymous();

app.Run();

// Exposed for integration testing (WebApplicationFactory).
public partial class Program;

using System.Text;
using System.Text.Json.Serialization;
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

    if (app.Environment.IsDevelopment() &&
        builder.Configuration.GetValue<bool>("DemoSeed:AtlasPerformance:Enabled"))
    {
        var tenantValue = builder.Configuration["DemoSeed:AtlasPerformance:TenantId"];
        if (!Guid.TryParse(tenantValue, out var atlasTenantId) || atlasTenantId == Guid.Empty)
            throw new InvalidOperationException(
                "DemoSeed:AtlasPerformance:TenantId must be a non-empty GUID when the Atlas seed is enabled.");
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(atlasTenantId);
        await AtlasPerformanceDemoSeeder.SeedAsync(dbContext, atlasTenantId, DateTime.UtcNow);

        var isolationTenantValue = builder.Configuration["DemoSeed:AtlasPerformance:IsolationTenantId"];
        if (!string.IsNullOrWhiteSpace(isolationTenantValue))
        {
            if (!Guid.TryParse(isolationTenantValue, out var isolationTenantId) ||
                isolationTenantId == Guid.Empty ||
                isolationTenantId == atlasTenantId)
            {
                throw new InvalidOperationException(
                    "DemoSeed:AtlasPerformance:IsolationTenantId must be a distinct non-empty GUID when provided.");
            }
            using var isolationScope = app.Services.CreateScope();
            isolationScope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(isolationTenantId);
            var isolationDbContext = isolationScope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            await AtlasPerformanceDemoSeeder.SeedIsolationTenantAsync(
                isolationDbContext, isolationTenantId, DateTime.UtcNow);
        }
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
app.UseRateLimiter();
app.MapControllers();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") }).AllowAnonymous();
app.MapPrometheusScrapingEndpoint("/metrics").AllowAnonymous();

app.Run();

// Exposed for integration testing (WebApplicationFactory).
public partial class Program;

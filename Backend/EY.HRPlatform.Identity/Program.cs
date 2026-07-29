using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Extensions;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.Identity.Middleware;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Register all services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddMultitenancy();
builder.Services.AddIdentityServices(builder.Configuration);

// CORS — allow Next.js frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var allowedOrigins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>();

        policy.WithOrigins(allowedOrigins ?? new[] { "http://localhost:3000" })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Health checks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppIdentityDbContext>();

var app = builder.Build();

// Apply database migrations and seed data on startup
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
    // Migrations require a relational provider (e.g. Npgsql). Use EnsureCreated for
    // in-memory/test configurations so local startup does not fail.
    if (!dbContext.Database.IsRelational())
        await dbContext.Database.EnsureCreatedAsync();
    else
        await dbContext.Database.MigrateAsync();

    var roleManager = scope.ServiceProvider
        .GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    var userManager = scope.ServiceProvider
        .GetRequiredService<UserManager<ApplicationUser>>();
    
    // Seed roles always; canonical demo data only when explicitly enabled.
    var legacyAutoSeed = builder.Configuration.GetValue<bool>("Database:AutoSeed");
    var seedDemoData = builder.Configuration.GetValue<bool>("Database:CanonicalSeed:Enabled");
    var resetCanonicalTenant = builder.Configuration.GetValue<bool>("Database:CanonicalSeed:Reset");
    if (app.Environment.IsDevelopment() && legacyAutoSeed && !seedDemoData)
        throw new InvalidOperationException(
            "Database:AutoSeed is retired. Use Database:CanonicalSeed:Enabled=true and scripts/fusion-demo.ps1.");
    if (resetCanonicalTenant)
    {
        if (!app.Environment.IsDevelopment())
            throw new InvalidOperationException("Canonical tenant reset is Development-only.");
        await IdentitySeeder.ResetCanonicalTenantAsync(dbContext);
    }

    await IdentitySeeder.SeedAsync(dbContext, roleManager, userManager, seedDemoData, builder.Configuration);
}

// Middleware pipeline (ORDER MATTERS!)
if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Docker"))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Health endpoint
app.MapHealthChecks("/health").AllowAnonymous();

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();
app.MapControllers();

app.Run();

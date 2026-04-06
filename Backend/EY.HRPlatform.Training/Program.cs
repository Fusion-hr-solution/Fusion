using EY.HRPlatform.Training.Extensions;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Middleware;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddTrainingServices(builder.Configuration);
builder.Services.AddAuthorization();

// Health checks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<TrainingDbContext>();

var app = builder.Build();

// Apply EF Core migrations on startup and seed data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TrainingDbContext>();
    await db.Database.MigrateAsync();
    await TrainingSeeder.SeedAsync(db);
}

if (app.Environment.IsDevelopment() || app.Environment.EnvironmentName == "Docker")
{
    app.UseSwagger(c => c.RouteTemplate = "api/training/swagger/{documentName}/swagger.json");
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("v1/swagger.json", "Training API v1");
        c.RoutePrefix = "api/training/swagger";
    });
}

// Health endpoint
app.MapHealthChecks("/health").AllowAnonymous();

app.UseMiddleware<GlobalExceptionHandlerMiddleware>();

// Serve uploaded chapter files (PDF, video) under /api/training/uploads
var uploadsPath = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/api/training/uploads",
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
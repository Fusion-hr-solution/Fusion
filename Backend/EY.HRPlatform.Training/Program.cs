using EY.HRPlatform.Training.Extensions;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Middleware;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddTrainingServices(builder.Configuration);
builder.Services.AddAuthorization();

var app = builder.Build();

// Apply EF Core migrations on startup and seed data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TrainingDbContext>();
    await db.Database.MigrateAsync();
    await TrainingSeeder.SeedAsync(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger(c => c.RouteTemplate = "api/training/swagger/{documentName}/swagger.json");
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("v1/swagger.json", "Training API v1");
        c.RoutePrefix = "api/training/swagger";
    });
}

app.UseMiddleware<GlobalExceptionHandlerMiddleware>();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
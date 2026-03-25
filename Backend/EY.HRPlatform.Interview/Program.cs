using EY.HRPlatform.Interview.Extensions;
using EY.HRPlatform.Interview.Infrastructure;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddInterviewServices(builder.Configuration);

var autoMigrate = builder.Configuration.GetValue<bool?>("Database:AutoMigrate")
                  ?? builder.Environment.IsDevelopment();
var app = builder.Build();
if (autoMigrate)
{
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.MigrateAsync();
    }
}
app.UseInterviewPipeline();

app.Run();

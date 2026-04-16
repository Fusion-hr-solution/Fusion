using EY.HRPlatform.Interview.Extensions;
using EY.HRPlatform.Interview.Infrastructure;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

var envPath = Path.Combine(builder.Environment.ContentRootPath, ".env");
if (File.Exists(envPath))
{
    Env.Load(envPath);
    builder.Configuration.AddEnvironmentVariables();
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddInterviewServices(builder.Configuration);

var autoMigrate = builder.Configuration.GetValue<bool?>("Database:AutoMigrate")
                  ?? builder.Environment.IsDevelopment();
var app = builder.Build();
if (autoMigrate)
{
    var connectionString = builder.Configuration.GetConnectionString("InterviewDb");
    if (!string.IsNullOrWhiteSpace(connectionString))
    {
        await EnsureDatabaseExistsAsync(connectionString);
    }

    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.MigrateAsync();
    }
}
app.UseInterviewPipeline();

app.Run();

static async Task EnsureDatabaseExistsAsync(string connectionString)
{
    var targetBuilder = new NpgsqlConnectionStringBuilder(connectionString);
    if (string.IsNullOrWhiteSpace(targetBuilder.Database))
        return;

    var targetDatabase = targetBuilder.Database;
    var adminBuilder = new NpgsqlConnectionStringBuilder(connectionString)
    {
        Database = "postgres",
        Pooling = false
    };

    await using var connection = new NpgsqlConnection(adminBuilder.ConnectionString);
    await connection.OpenAsync();

    await using var existsCommand = new NpgsqlCommand(
        "SELECT 1 FROM pg_database WHERE datname = @databaseName",
        connection);
    existsCommand.Parameters.AddWithValue("databaseName", targetDatabase);

    var databaseExists = await existsCommand.ExecuteScalarAsync();
    if (databaseExists is not null)
        return;

    var quotedDatabaseName = $"\"{targetDatabase.Replace("\"", "\"\"")}\"";
    await using var createDatabaseCommand = new NpgsqlCommand(
        $"CREATE DATABASE {quotedDatabaseName}",
        connection);
    await createDatabaseCommand.ExecuteNonQueryAsync();
}

public partial class Program
{
}
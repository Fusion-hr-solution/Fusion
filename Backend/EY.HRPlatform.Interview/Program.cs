using EY.HRPlatform.Interview.Extensions;
using EY.HRPlatform.Interview.Infrastructure;
using DotNetEnv;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Net;
using System.Net.Sockets;

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
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

    var forwardedHeadersSection = builder.Configuration.GetSection("Networking:ForwardedHeaders");

    var configuredForwardLimit = forwardedHeadersSection.GetValue<int?>("ForwardLimit");
    if (configuredForwardLimit.HasValue && configuredForwardLimit.Value > 0)
    {
        options.ForwardLimit = configuredForwardLimit.Value;
    }

    var knownProxies = forwardedHeadersSection.GetSection("KnownProxies").Get<string[]>() ?? [];
    foreach (var knownProxy in knownProxies)
    {
        if (IPAddress.TryParse(knownProxy, out var parsedProxy))
        {
            options.KnownProxies.Add(parsedProxy);
        }
    }

    var knownNetworks = forwardedHeadersSection.GetSection("KnownNetworks").Get<string[]>() ?? [];
    foreach (var knownNetwork in knownNetworks)
    {
        if (TryParseCidr(knownNetwork, out var parsedNetwork))
        {
            options.KnownIPNetworks.Add(parsedNetwork);
        }
    }
});
builder.Services.AddInterviewServices(builder.Configuration);

var autoMigrate = builder.Configuration.GetValue<bool?>("Database:AutoMigrate")
                  ?? builder.Environment.IsDevelopment();
var app = builder.Build();
app.UseForwardedHeaders();
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

static bool TryParseCidr(string? value, out System.Net.IPNetwork network)
{
    network = default;

    if (string.IsNullOrWhiteSpace(value))
    {
        return false;
    }

    var parts = value.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    if (parts.Length != 2 ||
        !IPAddress.TryParse(parts[0], out var prefix) ||
        !int.TryParse(parts[1], out var prefixLength))
    {
        return false;
    }

    var maxPrefixLength = prefix.AddressFamily == AddressFamily.InterNetwork ? 32 : 128;
    if (prefixLength < 0 || prefixLength > maxPrefixLength)
    {
        return false;
    }

    network = new System.Net.IPNetwork(prefix, prefixLength);
    return true;
}

public partial class Program
{
}
using EY.HRPlatform.Interview.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace EY.HRPlatform.Interview.Tests.TestHelpers;

public class InterviewApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"InterviewIntegration_{Guid.NewGuid()}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ASPNETCORE_ENVIRONMENT", "Testing");
        builder.UseSetting("DOTNET_ENVIRONMENT", "Testing");
        builder.UseSetting("Jwt:Secret", "integration-test-secret-please-change");
        builder.UseSetting("Database:AutoMigrate", "false");
        builder.UseSetting("Database:InMemoryName", _databaseName);
    }
}

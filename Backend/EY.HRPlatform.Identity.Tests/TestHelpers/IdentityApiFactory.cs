using EY.HRPlatform.Identity.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Identity.Tests.TestHelpers;

public class IdentityApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"IdentityIntegration_{Guid.NewGuid()}";

    public IdentityApiFactory()
    {
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("DOTNET_ENVIRONMENT", "Testing");

        // AddIdentityServices validates JWT secret and (in postgres mode) the connection string.
        Environment.SetEnvironmentVariable("ConnectionStrings__IdentityDb",
            "Host=localhost;Port=5432;Database=identity_integration_tests;Username=postgres;Password=postgres");

        Environment.SetEnvironmentVariable("Jwt__Secret", "integration-test-secret-please-change");
        Environment.SetEnvironmentVariable("Database__AutoSeed", "false");
        Environment.SetEnvironmentVariable("Database__Provider", "inmemory");
        Environment.SetEnvironmentVariable("Database__InMemoryName", _databaseName);
        Environment.SetEnvironmentVariable("Application__PublicBaseUrl", "http://localhost:3000");
        Environment.SetEnvironmentVariable("Application__InviteAcceptPath", "/core/invite/accept");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
    }
}


using EY.HRPlatform.Identity.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Identity.Tests.TestHelpers;

public class IdentityApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"IdentityIntegration_{Guid.NewGuid()}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        
        // Use UseSetting for configuration - these are applied before host builds
        builder.UseSetting("ConnectionStrings:IdentityDb", "Host=localhost;Port=5432;Database=identity_integration_tests;Username=postgres;Password=postgres");
        builder.UseSetting("Jwt:Secret", "integration-test-secret-please-change");
        builder.UseSetting("Database:AutoSeed", "false");
        builder.UseSetting("Database:Provider", "inmemory");
        builder.UseSetting("Database:InMemoryName", _databaseName);
        builder.UseSetting("Application:PublicBaseUrl", "http://localhost:3000");
        builder.UseSetting("Application:InviteAcceptPath", "/core/invite/accept");
    }
}


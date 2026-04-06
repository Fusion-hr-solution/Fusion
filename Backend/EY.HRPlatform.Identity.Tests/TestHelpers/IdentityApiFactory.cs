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
        
        builder.ConfigureAppConfiguration((_, config) =>
        {
            // Configuration is applied via in-memory settings to avoid global process state
            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:IdentityDb"] = "Host=localhost;Port=5432;Database=identity_integration_tests;Username=postgres;Password=postgres",
                ["Jwt:Secret"] = "integration-test-secret-please-change",
                ["Database:AutoSeed"] = "false",
                ["Database:Provider"] = "inmemory",
                ["Database:InMemoryName"] = _databaseName,
                ["Application:PublicBaseUrl"] = "http://localhost:3000",
                ["Application:InviteAcceptPath"] = "/core/invite/accept"
            };
            config.AddInMemoryCollection(settings);
        });
    }
}


using EY.HRPlatform.Interview.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace EY.HRPlatform.Interview.Tests.TestHelpers;

public class InterviewApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"InterviewIntegration_{Guid.NewGuid()}";

    public InterviewApiFactory()
    {
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("DOTNET_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("ConnectionStrings__InterviewDb", "Server=(localdb)\\mssqllocaldb;Database=InterviewTests;Trusted_Connection=True;");
        Environment.SetEnvironmentVariable("Database__AutoMigrate", "false");
        Environment.SetEnvironmentVariable("Database__InMemoryName", _databaseName);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
    }
}

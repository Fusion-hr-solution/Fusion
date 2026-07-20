using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace EY.HRPlatform.Interview.Tests.TestHelpers;

public class InterviewApiFactory : WebApplicationFactory<Program>
{
    // The API requires an authenticated caller by default (AddAuthorization FallbackPolicy), so
    // integration tests that hit protected routes must present a real bearer token. These values
    // are fed to the host via env vars and used here to mint tokens the JWT handler will accept.
    private const string JwtSecret = "interview-testing-signing-key-not-used-0123456789";
    private const string JwtIssuer = "EY.HRPlatform.Identity";
    private const string JwtAudience = "EY.HRPlatform";

    private readonly string _databaseName = $"InterviewIntegration_{Guid.NewGuid()}";

    public InterviewApiFactory()
    {
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("DOTNET_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("ConnectionStrings__InterviewDb", "Server=(localdb)\\mssqllocaldb;Database=InterviewTests;Trusted_Connection=True;");
        Environment.SetEnvironmentVariable("Database__AutoMigrate", "false");
        Environment.SetEnvironmentVariable("Database__InMemoryName", _databaseName);
        Environment.SetEnvironmentVariable("Jwt__Secret", JwtSecret);
        Environment.SetEnvironmentVariable("Jwt__Issuer", JwtIssuer);
        Environment.SetEnvironmentVariable("Jwt__Audience", JwtAudience);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        // Inject test config directly rather than relying on process env vars reaching
        // IConfiguration — the JWT handler reads Jwt:Issuer/Audience/Secret from config, and if they
        // are missing every token is rejected (ValidateIssuer with a null ValidIssuer never matches).
        builder.ConfigureAppConfiguration(config =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = JwtSecret,
                ["Jwt:Issuer"] = JwtIssuer,
                ["Jwt:Audience"] = JwtAudience,
                ["Database:InMemoryName"] = _databaseName,
                ["Database:AutoMigrate"] = "false",
            });
        });
    }

    /// <summary>An HttpClient carrying a valid bearer token — use for protected (admin/authoring)
    /// routes. Anonymous candidate routes should use <see cref="WebApplicationFactory{T}.CreateClient()"/>.</summary>
    public HttpClient CreateAuthenticatedClient(string email = "reviewer@example.com") =>
        Authenticate(CreateClient(), email);

    /// <inheritdoc cref="CreateAuthenticatedClient(string)"/>
    public HttpClient CreateAuthenticatedClient(WebApplicationFactoryClientOptions options, string email = "reviewer@example.com") =>
        Authenticate(CreateClient(options), email);

    private static HttpClient Authenticate(HttpClient client, string email)
    {
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", CreateToken(email));
        return client;
    }

    private static string CreateToken(string email)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: JwtIssuer,
            audience: JwtAudience,
            claims: [new Claim(ClaimTypes.Email, email), new Claim(ClaimTypes.Name, email)],
            expires: DateTime.UtcNow.AddMinutes(10),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

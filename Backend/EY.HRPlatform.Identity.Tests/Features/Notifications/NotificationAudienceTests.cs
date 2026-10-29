using System.Net;
using System.Net.Http.Json;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.Notifications;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Notifications;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace EY.HRPlatform.Identity.Tests.Features.Notifications;

/// <summary>
/// The language a module writes someone's email in, and the company's time zone for reminders (B-153): read from the
/// account and the company, within the named tenant only, and only for a signed internal caller.
/// </summary>
public sealed class NotificationAudienceTests : IAsyncLifetime
{
    private string? _admin;
    private readonly List<string> _databases = [];
    private bool Available => _admin is not null;

    public Task InitializeAsync()
    {
        var configured = Environment.GetEnvironmentVariable("FUSION_TEST_PG")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");
        if (!string.IsNullOrWhiteSpace(configured)) _admin = configured;
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        if (!Available) return;
        NpgsqlConnection.ClearAllPools();
        foreach (var database in _databases)
        {
            await using var connection = new NpgsqlConnection(AdminConnectionString());
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = $"DROP DATABASE IF EXISTS \"{database}\" WITH (FORCE);";
            await command.ExecuteNonQueryAsync();
        }
    }

    [SkippableFact]
    public async Task Each_person_gets_their_own_choice_else_the_company_language_and_the_company_time_zone()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var factory = await NewApiAsync();
        var tenantId = await AddTenantAsync(factory, "fr-FR", "Africa/Tunis");
        var chose = Guid.NewGuid(); var never = Guid.NewGuid(); var noAccount = Guid.NewGuid();
        await AddMemberAsync(factory, tenantId, chose, "ar");
        await AddMemberAsync(factory, tenantId, never, null);

        var audience = await ReadAsync(factory, new NotificationAudienceRequest(tenantId, [chose, never, noAccount]));

        Assert.NotNull(audience);
        Assert.Equal("Africa/Tunis", audience.TimeZone);
        Assert.Equal("fr", audience.Language);
        Assert.Equal("ar", audience.LanguageOf(chose));
        Assert.Equal("fr", audience.LanguageOf(never));
        Assert.Equal("fr", audience.LanguageOf(noAccount));
        Assert.DoesNotContain(audience.Recipients, recipient => recipient.EmployeeId == noAccount);
    }

    [SkippableFact]
    public async Task Another_tenants_employee_is_not_read()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var factory = await NewApiAsync();
        var mine = await AddTenantAsync(factory, "en-US", "UTC");
        var theirs = await AddTenantAsync(factory, "fr-FR", "Africa/Tunis");
        var employee = Guid.NewGuid();
        await AddMemberAsync(factory, theirs, employee, "ar");

        var audience = await ReadAsync(factory, new NotificationAudienceRequest(mine, [employee]));

        Assert.NotNull(audience);
        Assert.Empty(audience.Recipients);
        Assert.Equal("en", audience.LanguageOf(employee));
    }

    [SkippableFact]
    public async Task An_unknown_tenant_has_no_audience()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var factory = await NewApiAsync();

        Assert.Null(await ReadAsync(factory, new NotificationAudienceRequest(Guid.NewGuid(), [])));
    }

    [SkippableFact]
    public async Task An_unsigned_caller_is_refused()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var factory = await NewApiAsync();
        var tenantId = await AddTenantAsync(factory, "fr-FR", "Africa/Tunis");

        var response = await factory.CreateClient().PostAsJsonAsync("/internal/identity/notification-audience",
            new NotificationAudienceRequest(tenantId, []));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static async Task<NotificationAudience?> ReadAsync(AudienceApiFactory factory, NotificationAudienceRequest request)
    {
        using var scope = factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<NotificationAudienceReader>().ReadAsync(request, default);
    }

    private async Task<AudienceApiFactory> NewApiAsync()
    {
        var name = $"fusion_audience_{Guid.NewGuid():N}";
        await using (var connection = new NpgsqlConnection(AdminConnectionString()))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.CommandText = $"CREATE DATABASE \"{name}\";";
            await command.ExecuteNonQueryAsync();
        }
        _databases.Add(name);
        var factory = new AudienceApiFactory(new NpgsqlConnectionStringBuilder(_admin) { Database = name }.ConnectionString);
        using var scope = factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>().Database.MigrateAsync();
        return factory;
    }

    private string AdminConnectionString() => new NpgsqlConnectionStringBuilder(_admin) { Database = "postgres" }.ConnectionString;

    private static async Task<Guid> AddTenantAsync(AudienceApiFactory factory, string locale, string timeZone)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var tenant = Tenant.Create($"Atlas {Guid.NewGuid():N}"[..20]);
        tenant.ApplyInitialSettings(locale, timeZone, null);
        tenant.CompleteAdministratorActivation();
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();
        return tenant.Id;
    }

    private static async Task AddMemberAsync(AudienceApiFactory factory, Guid tenantId, Guid employeeId, string? preferredLanguage)
    {
        using var scope = factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var db = scope.ServiceProvider.GetRequiredService<AppIdentityDbContext>();
        var email = $"{Guid.NewGuid():N}@atlas.example";
        var account = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, FirstName = "Test", LastName = "Person",
            IsActive = true, EmailConfirmed = true, PreferredLanguage = preferredLanguage,
        };
        Assert.True((await users.CreateAsync(account, "Audience@123456")).Succeeded);
        var membership = TenantMembership.Create(account.Id, tenantId);
        membership.BindEmployee(employeeId);
        db.TenantMemberships.Add(membership);
        await db.SaveChangesAsync();
    }

    private sealed class AudienceApiFactory(string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:IdentityDb", connectionString);
            builder.UseSetting("Jwt:Secret", "integration-test-secret-please-change-please");
            builder.UseSetting("Jwt:Issuer", "fusion-tests");
            builder.UseSetting("Jwt:Audience", "fusion-tests");
            builder.UseSetting("Jwt:ExpirationInMinutes", "30");
            builder.UseSetting("Jwt:RefreshTokenExpirationInDays", "7");
            builder.UseSetting("Application:PublicBaseUrl", "http://localhost:3000");
        }
    }
}

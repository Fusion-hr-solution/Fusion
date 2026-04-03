using System.Reflection;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;
using EY.HRPlatform.Identity.Features.PlatformOrganizations.Services;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Identity.Tests.Features.PlatformOrganizations;

public class PlatformOrganizationServiceTests
{
    [Fact]
    public async Task ListAsync_ReturnsDraft_WhenNoHrAdminUserOrPendingInvite()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Draft Tenant");
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("draft", summary.OperationalStatus);
        Assert.Equal("Not invited", summary.FirstAdminStatus);
        Assert.Equal(0, summary.PendingInviteCount);
        Assert.Equal(0, summary.ActiveUserCount);
    }

    [Fact]
    public async Task ListAsync_ReturnsInvited_WhenPendingHrAdminInviteExists()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Invited Tenant");
        var createdBy = Guid.NewGuid();
        var invite = InviteToken.Create(
            "admin@example.com",
            tenant.Id,
            PlatformRole.HRAdmin,
            createdBy,
            expiryDays: 7);

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("invited", summary.OperationalStatus);
        Assert.Equal("Awaiting acceptance", summary.FirstAdminStatus);
        Assert.Equal(1, summary.PendingInviteCount);
    }

    [Fact]
    public async Task ListAsync_ReturnsActive_WhenHrAdminUserRoleExists()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Active Tenant");

        var hrRole = new IdentityRole<Guid>
        {
            Id = Guid.NewGuid(),
            Name = PlatformRole.HRAdmin,
            NormalizedName = PlatformRole.HRAdmin.ToUpperInvariant(),
        };

        var hrAdminUser = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "hradmin@example.com",
            Email = "hradmin@example.com",
            NormalizedEmail = "HRADMIN@EXAMPLE.COM",
            EmailConfirmed = true,
            TenantId = tenant.Id,
            IsActive = true,
            FirstName = "Hr",
            LastName = "Admin",
            LastLoginAt = DateTime.UtcNow.AddMinutes(-10),
        };

        db.Tenants.Add(tenant);
        db.Roles.Add(hrRole);
        db.Users.Add(hrAdminUser);
        db.UserRoles.Add(new IdentityUserRole<Guid>
        {
            UserId = hrAdminUser.Id,
            RoleId = hrRole.Id
        });

        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("active", summary.OperationalStatus);
        Assert.Equal("Verified", summary.FirstAdminStatus);
        Assert.Equal(1, summary.ActiveUserCount);
    }

    [Fact]
    public async Task ListAsync_ReturnsAttention_WhenHrAdminInviteExpiredAndNoHrAdminUser()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Attention Tenant");
        var createdBy = Guid.NewGuid();

        var invite = InviteToken.Create(
            "admin@example.com",
            tenant.Id,
            PlatformRole.HRAdmin,
            createdBy,
            expiryDays: 1);

        SetPrivateProperty(invite, "ExpiresAt", DateTime.UtcNow.AddMinutes(-1));

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("attention", summary.OperationalStatus);
        Assert.Equal("Action required", summary.FirstAdminStatus);
        Assert.Equal(0, summary.PendingInviteCount);
    }

    [Fact]
    public async Task ListAsync_ReturnsSuspended_WhenTenantIsInactive()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Suspended Tenant");
        tenant.Deactivate();
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("suspended", summary.OperationalStatus);
        Assert.Equal("Suspended", summary.FirstAdminStatus);
    }

    [Fact]
    public async Task ListAsync_ReturnsArchived_WhenTenantIsArchived()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Archived Tenant");
        tenant.Archive();
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();

        // Act
        var paged = await service.ListAsync(new PlatformOrganizationListQueryDto { Skip = 0, Take = 100 });
        var items = paged.Items;
        var summary = items.Single(x => x.Id == tenant.Id);

        // Assert
        Assert.Equal("archived", summary.OperationalStatus);
        Assert.Equal("Archived", summary.FirstAdminStatus);
    }

    [Fact]
    public async Task CreateAsync_CreatesTenantAndFirstInvite()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var createdBy = Guid.NewGuid();
        var request = new CreatePlatformOrganizationRequest
        {
            Name = "Test Org",
            FirstAdminEmail = "first.admin@example.com",
            FirstAdminFirstName = "First",
            FirstAdminLastName = "Admin",
        };

        // Act
        var created = await service.CreateAsync(request, createdBy);

        // Assert
        Assert.Equal("Test Org", created.Organization.Name);
        Assert.Equal("invited", created.Organization.OperationalStatus);
        Assert.NotNull(created.InviteLink);
        Assert.Contains("/core/invite/accept", created.InviteLink);
    }

    [Fact]
    public async Task CreateAsync_Throws_WhenEmailAlreadyRegistered()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var createdBy = Guid.NewGuid();

        db.Users.Add(new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "dup@example.com",
            Email = "dup@example.com",
            NormalizedEmail = "DUP@EXAMPLE.COM",
            EmailConfirmed = true,
            TenantId = Guid.NewGuid(),
            IsActive = true,
            FirstName = "Dup",
            LastName = "User",
        });
        await db.SaveChangesAsync();

        var request = new CreatePlatformOrganizationRequest
        {
            Name = "Should Fail Org",
            FirstAdminEmail = "dup@example.com",
        };

        // Act
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateAsync(request, createdBy));

        // Assert
        Assert.Contains("already registered", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ResendFirstAdminInviteAsync_ExtendsExpiryAndReturnsPending()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Resend Tenant");
        var createdBy = Guid.NewGuid();

        var invite = InviteToken.Create(
            "admin@example.com",
            tenant.Id,
            PlatformRole.HRAdmin,
            createdBy,
            expiryDays: 1);

        db.Tenants.Add(tenant);
        db.InviteTokens.Add(invite);
        await db.SaveChangesAsync();

        var beforeExpires = invite.ExpiresAt;

        // Act
        var dto = await service.ResendFirstAdminInviteAsync(
            tenant.Id,
            platformAdminUserId: Guid.NewGuid());

        // Assert
        Assert.NotNull(dto);
        Assert.Equal("pending", dto!.Status);
        Assert.True(dto.ExpiresAt > beforeExpires);
        Assert.NotNull(dto.InviteLink);
    }

    [Fact]
    public async Task RevokePendingFirstAdminInvitesAsync_RemovesAllPending()
    {
        // Arrange
        var db = CreateDbContext();
        var configuration = CreateConfiguration();
        var service = new PlatformOrganizationService(db, configuration);

        var tenant = Tenant.Create("Revoke Tenant");
        var createdBy = Guid.NewGuid();

        var invite1 = InviteToken.Create(
            "admin1@example.com",
            tenant.Id,
            PlatformRole.HRAdmin,
            createdBy);
        var invite2 = InviteToken.Create(
            "admin2@example.com",
            tenant.Id,
            PlatformRole.HRAdmin,
            createdBy);

        var accepted = InviteToken.Create(
            "accepted@example.com",
            tenant.Id,
            PlatformRole.HRAdmin,
            createdBy);
        accepted.MarkAccepted(Guid.NewGuid());

        db.Tenants.Add(tenant);
        db.InviteTokens.AddRange(invite1, invite2, accepted);
        await db.SaveChangesAsync();

        // Act
        var ok = await service.RevokePendingFirstAdminInvitesAsync(tenant.Id);

        // Assert
        Assert.True(ok);
        var remainingPending = db.InviteTokens
            .Where(i => i.TenantId == tenant.Id && i.Role == PlatformRole.HRAdmin && i.AcceptedAt == null)
            .ToList();
        Assert.Empty(remainingPending);
    }

    private static AppIdentityDbContext CreateDbContext(string? databaseName = null)
    {
        var dbName = databaseName ?? $"PlatformAdmin_{Guid.NewGuid()}";

        var options = new DbContextOptionsBuilder<AppIdentityDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        var db = new AppIdentityDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    private static IConfiguration CreateConfiguration()
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Application:PublicBaseUrl"] = "http://localhost:3000",
                ["Application:InviteAcceptPath"] = "/core/invite/accept",
            })
            .Build();
    }

    private static void SetPrivateProperty<T>(T instance, string propertyName, object value)
    {
        var prop = instance!.GetType().GetProperty(
            propertyName,
            BindingFlags.Instance | BindingFlags.Public);

        if (prop is null)
            throw new InvalidOperationException($"Property '{propertyName}' not found.");

        var setter = prop.GetSetMethod(true);
        if (setter is null)
            throw new InvalidOperationException($"No setter for '{propertyName}'.");

        setter.Invoke(instance, new[] { value });
    }
}


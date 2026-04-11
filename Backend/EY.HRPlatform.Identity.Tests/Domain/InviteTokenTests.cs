using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Tests.Domain;

public class InviteTokenTests
{
    private readonly Guid _validTenantId = Guid.NewGuid();
    private readonly Guid _validUserId = Guid.NewGuid();
    private const string ValidEmail = "test@example.com";
    private const string ValidRole = PlatformRole.Employee;

    [Fact]
    public void Create_WithValidInputs_ReturnsInviteToken()
    {
        // Act
        var invite = InviteToken.Create(
            ValidEmail,
            _validTenantId,
            ValidRole,
            _validUserId);

        // Assert
        Assert.NotEqual(Guid.Empty, invite.Id);
        Assert.NotEmpty(invite.Token);
        Assert.Equal(ValidEmail.ToLowerInvariant(), invite.Email);
        Assert.Equal(_validTenantId, invite.TenantId);
        Assert.Equal(ValidRole, invite.Role);
        Assert.Null(invite.FirstName);
        Assert.Null(invite.LastName);
        Assert.True(invite.ExpiresAt > DateTime.UtcNow);
        Assert.Null(invite.AcceptedAt);
        Assert.Null(invite.AcceptedByUserId);
        Assert.True(invite.CreatedAt <= DateTime.UtcNow);
        Assert.Equal(_validUserId, invite.CreatedByUserId);
    }

    [Fact]
    public void Create_WithOptionalNames_SetsNames()
    {
        // Act
        var invite = InviteToken.Create(
            ValidEmail,
            _validTenantId,
            ValidRole,
            _validUserId,
            firstName: "John",
            lastName: "Doe");

        // Assert
        Assert.Equal("John", invite.FirstName);
        Assert.Equal("Doe", invite.LastName);
    }

    [Fact]
    public void Create_TokenIsBase64UrlEncoded()
    {
        // Act
        var invite = InviteToken.Create(
            ValidEmail,
            _validTenantId,
            ValidRole,
            _validUserId);

        // Assert - base64url should not contain +, /, or =
        Assert.DoesNotContain("+", invite.Token);
        Assert.DoesNotContain("/", invite.Token);
        Assert.DoesNotContain("=", invite.Token);
        // 32 bytes base64url encoded should be ~43 characters
        Assert.InRange(invite.Token.Length, 40, 50);
    }

    [Fact]
    public void Create_TokensAreUnique()
    {
        // Act
        var invite1 = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);
        var invite2 = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);

        // Assert
        Assert.NotEqual(invite1.Token, invite2.Token);
    }

    [Fact]
    public void Create_DefaultExpiryIs7Days()
    {
        // Act
        var invite = InviteToken.Create(
            ValidEmail,
            _validTenantId,
            ValidRole,
            _validUserId);

        // Assert - should expire in approximately 7 days
        var expectedExpiry = DateTime.UtcNow.AddDays(7);
        Assert.InRange(invite.ExpiresAt, expectedExpiry.AddMinutes(-1), expectedExpiry.AddMinutes(1));
    }

    [Fact]
    public void Create_CustomExpiryDays_SetsCorrectExpiry()
    {
        // Act
        var invite = InviteToken.Create(
            ValidEmail,
            _validTenantId,
            ValidRole,
            _validUserId,
            expiryDays: 14);

        // Assert
        var expectedExpiry = DateTime.UtcNow.AddDays(14);
        Assert.InRange(invite.ExpiresAt, expectedExpiry.AddMinutes(-1), expectedExpiry.AddMinutes(1));
    }

    [Fact]
    public void Create_NormalizesEmailToLowercase()
    {
        // Act
        var invite = InviteToken.Create(
            "TEST@EXAMPLE.COM",
            _validTenantId,
            ValidRole,
            _validUserId);

        // Assert
        Assert.Equal("test@example.com", invite.Email);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidEmail_ThrowsArgumentException(string? email)
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            InviteToken.Create(email!, _validTenantId, ValidRole, _validUserId));
        Assert.Contains("Email", ex.Message);
    }

    [Fact]
    public void Create_WithInvalidEmailFormat_ThrowsArgumentException()
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            InviteToken.Create("notanemail", _validTenantId, ValidRole, _validUserId));
        Assert.Contains("email", ex.Message.ToLower());
    }

    [Fact]
    public void Create_WithEmptyTenantId_ThrowsArgumentException()
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            InviteToken.Create(ValidEmail, Guid.Empty, ValidRole, _validUserId));
        Assert.Contains("Tenant", ex.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidRole_ThrowsArgumentException(string? role)
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            InviteToken.Create(ValidEmail, _validTenantId, role!, _validUserId));
        Assert.Contains("Role", ex.Message);
    }

    [Fact]
    public void Create_WithNonExistentRole_ThrowsArgumentException()
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            InviteToken.Create(ValidEmail, _validTenantId, "InvalidRole", _validUserId));
        Assert.Contains("Invalid role", ex.Message);
    }

    [Fact]
    public void Create_WithEmptyCreatedByUserId_ThrowsArgumentException()
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            InviteToken.Create(ValidEmail, _validTenantId, ValidRole, Guid.Empty));
        Assert.Contains("Creator", ex.Message);
    }

    [Fact]
    public void IsValid_WhenNotExpiredAndNotUsed_ReturnsTrue()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);

        // Assert
        Assert.True(invite.IsValid);
        Assert.False(invite.IsExpired);
        Assert.False(invite.IsUsed);
    }

    [Fact]
    public void MarkAccepted_SetsAcceptedAtAndUserId()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);
        var acceptingUserId = Guid.NewGuid();

        // Act
        invite.MarkAccepted(acceptingUserId);

        // Assert
        Assert.NotNull(invite.AcceptedAt);
        Assert.True(invite.AcceptedAt <= DateTime.UtcNow);
        Assert.Equal(acceptingUserId, invite.AcceptedByUserId);
        Assert.True(invite.IsUsed);
        Assert.False(invite.IsValid);
    }

    [Fact]
    public void MarkAccepted_WithEmptyUserId_ThrowsArgumentException()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() => invite.MarkAccepted(Guid.Empty));
        Assert.Contains("User ID", ex.Message);
    }

    [Fact]
    public void MarkAccepted_WhenAlreadyAccepted_ThrowsInvalidOperationException()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);
        invite.MarkAccepted(Guid.NewGuid());

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => invite.MarkAccepted(Guid.NewGuid()));
        Assert.Contains("already been accepted", ex.Message);
    }

    [Fact]
    public void Create_AllValidRoles_Succeeds()
    {
        // All platform roles should be valid
        foreach (var role in PlatformRole.All)
        {
            var invite = InviteToken.Create(ValidEmail, _validTenantId, role, _validUserId);
            Assert.Equal(role, invite.Role);
        }
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-100)]
    public void Create_WithZeroOrNegativeExpiryDays_ThrowsArgumentException(int expiryDays)
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId, expiryDays: expiryDays));
        Assert.Contains("Expiry days", ex.Message);
    }

    [Fact]
    public void Create_WithExpiryDaysExceeding90_ThrowsArgumentException()
    {
        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() =>
            InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId, expiryDays: 91));
        Assert.Contains("Expiry days", ex.Message);
    }

    [Theory]
    [InlineData("   ")]
    [InlineData("  \t  ")]
    [InlineData("")]
    public void Create_WithWhitespaceOnlyNames_NormalizesToNull(string whitespace)
    {
        // Act
        var invite = InviteToken.Create(
            ValidEmail,
            _validTenantId,
            ValidRole,
            _validUserId,
            firstName: whitespace,
            lastName: whitespace);

        // Assert - whitespace-only names should become null
        Assert.Null(invite.FirstName);
        Assert.Null(invite.LastName);
    }

    [Fact]
    public void Create_WithNamesWithSurroundingWhitespace_TrimsNames()
    {
        // Act
        var invite = InviteToken.Create(
            ValidEmail,
            _validTenantId,
            ValidRole,
            _validUserId,
            firstName: "  John  ",
            lastName: "  Doe  ");

        // Assert - names should be trimmed
        Assert.Equal("John", invite.FirstName);
        Assert.Equal("Doe", invite.LastName);
    }

    [Fact]
    public void ExtendExpiry_WithDefaultDays_ExtendsBy7Days()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId, expiryDays: 1);
        var originalExpiry = invite.ExpiresAt;

        // Act
        invite.ExtendExpiry();

        // Assert
        var expectedExpiry = DateTime.UtcNow.AddDays(7);
        Assert.InRange(invite.ExpiresAt, expectedExpiry.AddMinutes(-1), expectedExpiry.AddMinutes(1));
        Assert.True(invite.ExpiresAt > originalExpiry);
    }

    [Fact]
    public void ExtendExpiry_WithCustomDays_ExtendsCorrectly()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);

        // Act
        invite.ExtendExpiry(days: 14);

        // Assert
        var expectedExpiry = DateTime.UtcNow.AddDays(14);
        Assert.InRange(invite.ExpiresAt, expectedExpiry.AddMinutes(-1), expectedExpiry.AddMinutes(1));
    }

    [Fact]
    public void ExtendExpiry_WhenAlreadyAccepted_ThrowsInvalidOperationException()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);
        invite.MarkAccepted(Guid.NewGuid());

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => invite.ExtendExpiry());
        Assert.Contains("accepted", ex.Message.ToLower());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void ExtendExpiry_WithInvalidDays_ThrowsArgumentException(int days)
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() => invite.ExtendExpiry(days));
        Assert.Contains("Expiry days", ex.Message);
    }

    [Fact]
    public void ExtendExpiry_WithDaysExceeding90_ThrowsArgumentException()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() => invite.ExtendExpiry(91));
        Assert.Contains("Expiry days", ex.Message);
    }

    [Fact]
    public void ExtendExpiry_WhenRevoked_ThrowsInvalidOperationException()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);
        invite.Revoke();

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => invite.ExtendExpiry());
        Assert.Contains("revoked", ex.Message.ToLower());
    }

    [Fact]
    public void MarkAccepted_WhenExpired_ThrowsInvalidOperationException()
    {
        // Arrange — create with 1 day expiry, then use reflection to expire it
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId, expiryDays: 1);
        var prop = invite.GetType().GetProperty("ExpiresAt")!;
        prop.GetSetMethod(true)!.Invoke(invite, [DateTime.UtcNow.AddMinutes(-1)]);

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => invite.MarkAccepted(Guid.NewGuid()));
        Assert.Contains("expired", ex.Message.ToLower());
    }

    [Fact]
    public void Revoke_SetsIsRevokedAndRevokedAt()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);

        // Act
        invite.Revoke();

        // Assert
        Assert.True(invite.IsRevoked);
        Assert.NotNull(invite.RevokedAt);
        Assert.True(invite.RevokedAt <= DateTime.UtcNow);
        Assert.False(invite.IsValid);
    }

    [Fact]
    public void Revoke_WhenAlreadyAccepted_ThrowsInvalidOperationException()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);
        invite.MarkAccepted(Guid.NewGuid());

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => invite.Revoke());
        Assert.Contains("accepted", ex.Message.ToLower());
    }

    [Fact]
    public void Revoke_WhenAlreadyRevoked_ThrowsInvalidOperationException()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);
        invite.Revoke();

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() => invite.Revoke());
        Assert.Contains("already revoked", ex.Message.ToLower());
    }

    [Fact]
    public void IsValid_WhenRevoked_ReturnsFalse()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);
        invite.Revoke();

        // Assert
        Assert.False(invite.IsValid);
        Assert.True(invite.IsRevoked);
    }

    [Fact]
    public void ExtendExpiry_WhenExpiredButNotAcceptedOrRevoked_Succeeds()
    {
        // Arrange — create with 1 day expiry, then expire it via reflection
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId, expiryDays: 1);
        var prop = invite.GetType().GetProperty("ExpiresAt")!;
        prop.GetSetMethod(true)!.Invoke(invite, [DateTime.UtcNow.AddMinutes(-30)]);

        Assert.True(invite.IsExpired);
        Assert.False(invite.IsValid);

        // Act — extending an expired invite should succeed (resend scenario)
        invite.ExtendExpiry();

        // Assert — now valid again with fresh 7-day window
        var expectedExpiry = DateTime.UtcNow.AddDays(7);
        Assert.InRange(invite.ExpiresAt, expectedExpiry.AddMinutes(-1), expectedExpiry.AddMinutes(1));
        Assert.False(invite.IsExpired);
        Assert.True(invite.IsValid);
    }

    [Fact]
    public void IsExpired_WhenExpiresAtInFuture_ReturnsFalse()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId, expiryDays: 7);

        // Assert
        Assert.False(invite.IsExpired);
    }

    [Fact]
    public void IsUsed_WhenNotAccepted_ReturnsFalse()
    {
        // Arrange
        var invite = InviteToken.Create(ValidEmail, _validTenantId, ValidRole, _validUserId);

        // Assert
        Assert.False(invite.IsUsed);
        Assert.Null(invite.AcceptedAt);
        Assert.Null(invite.AcceptedByUserId);
    }
}

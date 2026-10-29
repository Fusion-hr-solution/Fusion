using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

namespace EY.HRPlatform.SharedKernel.Notifications;

/// <summary>Who a one-click unsubscribe is for: one recipient in one tenant, and one email group.</summary>
public sealed record UnsubscribeClaim(Guid TenantId, Guid RecipientEmployeeId, string Group);

/// <summary>
/// The token in a one-click unsubscribe link: the claim plus an HMAC-SHA256 over it with the module's key, so a link
/// can only turn off the group it was sent for, for the person it was sent to. It doesn't expire: an unsubscribe link
/// in an old email still has to work.
/// </summary>
public static class UnsubscribeToken
{
    private const string Version = "u1";

    public static string Issue(UnsubscribeClaim claim, string key)
    {
        var body = Body(claim);
        return $"{WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(body))}.{WebEncoders.Base64UrlEncode(Sign(body, key))}";
    }

    public static UnsubscribeClaim? Read(string? token, string key)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 512) return null;
        var parts = token.Split('.');
        if (parts.Length != 2) return null;
        try
        {
            var body = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(parts[0]));
            if (!CryptographicOperations.FixedTimeEquals(WebEncoders.Base64UrlDecode(parts[1]), Sign(body, key))) return null;
            var fields = body.Split('|');
            return fields.Length == 4 && fields[0] == Version && Guid.TryParseExact(fields[1], "N", out var tenant)
                && Guid.TryParseExact(fields[2], "N", out var recipient) && tenant != Guid.Empty && recipient != Guid.Empty
                && fields[3].Length is > 0 and <= 64
                ? new UnsubscribeClaim(tenant, recipient, fields[3]) : null;
        }
        catch (FormatException) { return null; }
    }

    private static string Body(UnsubscribeClaim claim) => $"{Version}|{claim.TenantId:N}|{claim.RecipientEmployeeId:N}|{claim.Group}";

    private static byte[] Sign(string body, string key)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
            throw new InvalidOperationException("Notifications:UnsubscribeKey must be at least 32 characters.");
        return HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(body));
    }
}

using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Identity.Infrastructure.Services;

public static class InvitationLinkBuilder
{
    private const string DefaultPublicBaseUrl = "http://localhost:3000";
    private const string InviteAcceptPath = "/invite/accept";

    public static string Build(IConfiguration configuration, string token)
    {
        var publicBaseUrl = configuration["Application:PublicBaseUrl"];
        return Build(publicBaseUrl, token);
    }

    public static string Build(string? publicBaseUrl, string token)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(token);

        var normalizedBaseUrl = string.IsNullOrWhiteSpace(publicBaseUrl)
            ? DefaultPublicBaseUrl
            : publicBaseUrl.TrimEnd('/');

        return $"{normalizedBaseUrl}{InviteAcceptPath}?token={Uri.EscapeDataString(token)}";
    }
}

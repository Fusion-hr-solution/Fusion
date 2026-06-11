using Microsoft.Extensions.Configuration;

namespace EY.HRPlatform.Identity.Infrastructure.Services;

public sealed class InvitationLinkBuilder(IConfiguration configuration) : IInvitationLinkBuilder
{
    private const string DefaultPublicBaseUrl = "http://localhost:3000";
    private const string DefaultInviteAcceptPath = "/invite/accept";
    private readonly IConfiguration _configuration = configuration;

    public string BuildInviteLink(string token)
    {
        return Build(_configuration, token);
    }

    public static string Build(IConfiguration configuration, string token)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var publicBaseUrl = configuration["Application:PublicBaseUrl"];
        var inviteAcceptPath = configuration["Application:InviteAcceptPath"];

        return Build(publicBaseUrl, token, inviteAcceptPath);
    }

    public static string Build(string? publicBaseUrl, string token)
    {
        return Build(publicBaseUrl, token, null);
    }

    private static string Build(string? publicBaseUrl, string token, string? inviteAcceptPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(token);

        var normalizedBaseUrl = string.IsNullOrWhiteSpace(publicBaseUrl)
            ? DefaultPublicBaseUrl
            : publicBaseUrl.TrimEnd('/');
        var normalizedInviteAcceptPath = NormalizeInviteAcceptPath(inviteAcceptPath);

        return $"{normalizedBaseUrl}{normalizedInviteAcceptPath}?token={Uri.EscapeDataString(token)}";
    }

    private static string NormalizeInviteAcceptPath(string? inviteAcceptPath)
    {
        if (string.IsNullOrWhiteSpace(inviteAcceptPath))
        {
            return DefaultInviteAcceptPath;
        }

        return inviteAcceptPath.StartsWith('/')
            ? inviteAcceptPath
            : $"/{inviteAcceptPath}";
    }
}

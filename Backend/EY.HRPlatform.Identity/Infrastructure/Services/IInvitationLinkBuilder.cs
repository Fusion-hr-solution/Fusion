namespace EY.HRPlatform.Identity.Infrastructure.Services;

public interface IInvitationLinkBuilder
{
    string BuildInviteLink(string token);
}

public sealed class InvitationLinkBuilder(IConfiguration configuration) : IInvitationLinkBuilder
{
    public string BuildInviteLink(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ArgumentException("Invite token is required.", nameof(token));
        }

        var baseUrl = configuration["Application:PublicBaseUrl"]?.Trim();
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            baseUrl = "http://localhost:3000";
        }

        var inviteAcceptPath = configuration["Application:InviteAcceptPath"]?.Trim();
        if (string.IsNullOrWhiteSpace(inviteAcceptPath))
        {
            inviteAcceptPath = "/core/invite/accept";
        }

        baseUrl = baseUrl.TrimEnd('/');
        inviteAcceptPath = inviteAcceptPath.StartsWith('/')
            ? inviteAcceptPath
            : $"/{inviteAcceptPath}";

        return $"{baseUrl}{inviteAcceptPath}?token={Uri.EscapeDataString(token)}";
    }
}
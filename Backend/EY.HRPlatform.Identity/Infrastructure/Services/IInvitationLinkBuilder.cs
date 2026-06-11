namespace EY.HRPlatform.Identity.Infrastructure.Services;

public interface IInvitationLinkBuilder
{
    string BuildInviteLink(string token);
}

namespace EY.HRPlatform.SharedKernel.Notifications;

/// <summary>What a notification email says, already worded in the recipient's language by its module.</summary>
public sealed record NotificationEmailText(string Subject, string Lead, string ActionLabel);

/// <summary>Why the recipient got it: the email group, worded, and whether a person can turn it off.</summary>
public sealed record NotificationEmailGroup(string Name, bool CanTurnOff);

/// <summary>
/// The notification email every module sends (B-002 N6): the shared layout, a footer that says why it was sent, the
/// company it was sent for and a link to the person's notification settings.
/// </summary>
public static class FusionNotificationEmail
{
    public const string SettingsPath = "/settings/notifications";

    public static readonly NotificationCatalog Text =
        NotificationCatalog.FromAssembly(typeof(FusionNotificationEmail).Assembly, "EY.HRPlatform.SharedKernel.Notifications.Text.email");

    public static RenderedEmail Render(string language, NotificationEmailText text, string actionUrl, NotificationEmailGroup group,
        string companyName, string shellBaseUrl)
    {
        var footer = new List<string>
        {
            Text.Text(language, group.CanTurnOff ? "footer.why" : "footer.locked", new Dictionary<string, string> { ["group"] = group.Name })!,
        };
        if (!string.IsNullOrWhiteSpace(companyName))
            footer.Add(Text.Text(language, "footer.company", new Dictionary<string, string> { ["company"] = companyName.Trim() })!);
        return FusionEmailLayout.Render(new FusionEmailContent(
            language, text.Subject, text.Subject, [text.Lead], text.ActionLabel, actionUrl, footer,
            FallbackLinkNote: Text.Text(language, "footer.fallback"),
            FooterLink: new FusionEmailLink(Text.Text(language, "footer.settings")!, $"{shellBaseUrl.TrimEnd('/')}{SettingsPath}")));
    }
}

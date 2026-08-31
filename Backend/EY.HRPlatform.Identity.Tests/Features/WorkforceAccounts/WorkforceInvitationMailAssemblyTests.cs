using EY.HRPlatform.Identity.Features.WorkforceAccounts;

namespace EY.HRPlatform.Identity.Tests.Features.WorkforceAccounts;

/// <summary>
/// The workforce invitation is assembled from the one canonical renderer as a multipart
/// message — plain text body, HTML alternate — carrying Fusion branding and never the
/// legacy `EY HR Platform` name. This pins the 3.6 migration off the old inline HTML.
/// </summary>
public sealed class WorkforceInvitationMailAssemblyTests
{
    private static readonly DateTime Expiry = new(2026, 8, 24, 9, 30, 0, DateTimeKind.Utc);

    private static WorkforceInvitationEmailMessage AMessage(
        IReadOnlyList<string>? profiles = null,
        string? recipient = "Casey Rivera") => new(
            InviteId: Guid.NewGuid(),
            TenantId: Guid.NewGuid(),
            TenantName: "Atlas Group",
            EmployeeId: Guid.NewGuid(),
            Email: "casey@atlas.example",
            RecipientName: recipient,
            InviteLink: "http://localhost:3000/activate-invitation?credential=sel.secret",
            ExpiresAt: Expiry,
            AccessProfileNames: profiles ?? ["Employee"]);

    [Fact]
    public void Rendered_workforce_invitation_uses_canonical_copy_and_fusion_branding()
    {
        var rendered = WorkforceInvitationMailAssembly.Render(AMessage());

        Assert.Equal("Activate your Fusion access for Atlas Group", rendered.Subject);
        Assert.Contains("Activate your Fusion account", rendered.Html);
        Assert.Contains(">Activate Fusion access</a>", rendered.Html);

        foreach (var body in new[] { rendered.Html, rendered.Text, rendered.Subject })
        {
            Assert.DoesNotContain("EY HR Platform", body);
        }
    }

    [Fact]
    public void The_assembled_mail_carries_text_body_and_html_alternate()
    {
        using var mail = WorkforceInvitationMailAssembly.Build(AMessage(), new WorkforceInvitationEmailOptions());

        Assert.False(mail.IsBodyHtml);
        Assert.StartsWith("Fusion", mail.Body);
        Assert.DoesNotContain("<html", mail.Body, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("casey@atlas.example", Assert.Single(mail.To).Address);
        Assert.Equal("Fusion", mail.From!.DisplayName);

        var alternate = Assert.Single(mail.AlternateViews);
        Assert.Equal("text/html", alternate.ContentType.MediaType);

        using var reader = new StreamReader(alternate.ContentStream);
        var html = reader.ReadToEnd();
        Assert.Contains("<!doctype html>", html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Atlas Group", html);
    }

    [Fact]
    public void The_friendly_access_summary_is_shown_when_present_and_omitted_when_empty()
    {
        var withSummary = WorkforceInvitationMailAssembly.Render(AMessage(profiles: ["Manager"]));
        Assert.Contains("Manager", withSummary.Html);
        Assert.Contains("Manager", withSummary.Text);

        var withoutSummary = WorkforceInvitationMailAssembly.Render(AMessage(profiles: []));
        Assert.DoesNotContain("Access:", withoutSummary.Text);
    }
}

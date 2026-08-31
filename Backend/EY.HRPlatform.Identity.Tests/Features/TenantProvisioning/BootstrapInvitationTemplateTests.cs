using EY.HRPlatform.Identity.Features.TenantProvisioning;

namespace EY.HRPlatform.Identity.Tests.Features.TenantProvisioning;

/// <summary>
/// What the recipient actually reads. These assert on the rendered message rather
/// than on the fact that a send was attempted, because a message that arrives
/// without the tenant, the expiry or a working action is a delivery that failed
/// in every way that matters to the recipient.
/// </summary>
public sealed class BootstrapInvitationTemplateTests
{
    private static readonly DateTime Expiry = new(2026, 8, 14, 9, 30, 0, DateTimeKind.Utc);

    private static BootstrapInvitationMessage AMessage(
        string tenantName = "Atlas Group",
        string email = "admin@atlas.example") => new(
            TenantName: tenantName,
            Email: email,
            ActivationLink: "http://localhost:3000/activate-invitation?credential=sel.secret",
            ExpiresAtUtc: Expiry);

    [Fact]
    public void Both_representations_carry_the_required_content()
    {
        var rendered = BootstrapInvitationTemplate.Render(AMessage());

        Assert.Equal("Set up your Fusion administrator account for Atlas Group", rendered.Subject);

        foreach (var body in new[] { rendered.Html, rendered.Text })
        {
            Assert.Contains("Atlas Group", body);
            Assert.Contains("admin@atlas.example", body);
            Assert.Contains("http://localhost:3000/activate-invitation?credential=sel.secret", body);
            Assert.Contains("14 August 2026 at 09:30 UTC", body);

            // `Fusion` is the visible identity, carried as text.
            Assert.Contains("Fusion", body);
        }
    }

    [Fact]
    public void The_message_offers_exactly_one_account_creation_action()
    {
        var rendered = BootstrapInvitationTemplate.Render(AMessage());

        // One anchor, and the copy of the address below it is plain text — an
        // invitation with two competing buttons is an invitation with no clear
        // action.
        var anchors = rendered.Html.Split("<a ").Length - 1;
        Assert.Equal(1, anchors);
        Assert.Contains("Set up administrator account", rendered.Html);
        Assert.Contains("Set up administrator account", rendered.Text);
    }

    [Fact]
    public void The_message_carries_no_credential_identifier_or_internal_terminology()
    {
        var rendered = BootstrapInvitationTemplate.Render(AMessage());

        string[] forbidden =
        [
            // No readable credential or temporary password of any kind.
            "temporary password", "your password is", "password:",
            // No internal vocabulary or identifiers.
            "InviteToken", "TenantMembership", "org-admin", "OrganizationBootstrap",
            "invitationId", "tenantId", "correlation", "AccessProfile",
            // No marketing or feature promotion.
            "unlock", "powerful", "all-in-one", "get started with everything",
        ];

        foreach (var body in new[] { rendered.Html, rendered.Text, rendered.Subject })
        {
            foreach (var term in forbidden)
            {
                Assert.DoesNotContain(term, body, StringComparison.OrdinalIgnoreCase);
            }
        }
    }

    [Fact]
    public void The_message_needs_no_remote_asset_to_render()
    {
        var rendered = BootstrapInvitationTemplate.Render(AMessage());

        // Text identity only. A blocked logo must not leave the message unbranded
        // or, worse, visibly broken.
        Assert.DoesNotContain("<img", rendered.Html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("background-image", rendered.Html, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Tenant_names_cannot_inject_markup()
    {
        var rendered = BootstrapInvitationTemplate.Render(
            AMessage(tenantName: "<script>alert(1)</script>"));

        Assert.DoesNotContain("<script>", rendered.Html);
        Assert.Contains("&lt;script&gt;", rendered.Html);
    }

    [Fact]
    public void The_delivered_message_carries_text_and_html_as_distinct_parts()
    {
        using var mail = SmtpBootstrapInvitationEmailSender.BuildMessage(
            AMessage(), new BootstrapInvitationEmailOptions());

        // The body is the plain text; the HTML is the alternate. Getting this
        // backwards still sends and still renders in a graphical client, so it is
        // only visible to someone reading the message as plain text — which is
        // exactly why it is asserted here rather than left to inspection.
        Assert.False(mail.IsBodyHtml);
        Assert.StartsWith("Fusion", mail.Body);
        Assert.DoesNotContain("<html", mail.Body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<table", mail.Body, StringComparison.OrdinalIgnoreCase);

        var alternate = Assert.Single(mail.AlternateViews);
        Assert.Equal("text/html", alternate.ContentType.MediaType);

        using var reader = new StreamReader(alternate.ContentStream);
        var html = reader.ReadToEnd();
        Assert.Contains("<!doctype html>", html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Atlas Group", html);
    }

    [Fact]
    public void The_delivered_message_is_addressed_to_the_invited_recipient()
    {
        using var mail = SmtpBootstrapInvitationEmailSender.BuildMessage(
            AMessage(email: "admin@atlas.example"), new BootstrapInvitationEmailOptions());

        Assert.Equal("admin@atlas.example", Assert.Single(mail.To).Address);
        Assert.Equal("Fusion", mail.From!.DisplayName);
        Assert.Equal("Set up your Fusion administrator account for Atlas Group", mail.Subject);
    }

    [Fact]
    public void A_local_expiry_is_still_stated_as_utc()
    {
        var unspecified = new DateTime(2026, 8, 14, 9, 30, 0, DateTimeKind.Unspecified);
        Assert.Equal("14 August 2026 at 09:30 UTC", BootstrapInvitationTemplate.FormatExpiry(unspecified));
    }
}

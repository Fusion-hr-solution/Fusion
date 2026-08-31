using System.Text.RegularExpressions;
using EY.HRPlatform.Identity.Domain.Entities;
using EY.HRPlatform.Identity.Domain.Enums;

namespace EY.HRPlatform.Identity.Tests.Features.TenantAdministration;

/// <summary>
/// The old ways in.
/// <para>
/// A serialized invariant is worth nothing if an older endpoint can still change
/// who administers a tenant without passing through it. These tests hold that
/// containment in place, because it is the kind of guarantee that erodes quietly
/// — one convenient direct write at a time.
/// </para>
/// </summary>
public sealed class LegacyPathContainmentTests
{
    private static readonly string IdentityRoot =
        Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory, "..", "..", "..", "..", "EY.HRPlatform.Identity"));

    // ── Purpose separation ───────────────────────────────

    [Fact]
    public void The_workforce_factory_cannot_produce_an_administrative_invitation()
    {
        var invitation = InviteToken.Create(
            "member@atlas.example", Guid.NewGuid(), "Employee", Guid.NewGuid());

        // The factory takes no purpose at all, so a workforce route has no way to
        // mint administrator authority even by mistake.
        Assert.Equal(InvitationPurpose.WorkforceAccount, invitation.Purpose);
        Assert.False(InvitationPurposes.IsAdministrative(invitation.Purpose));
    }

    [Theory]
    [InlineData(InvitationPurpose.WorkforceAccount)]
    [InlineData(InvitationPurpose.OrganizationBootstrap)]
    public void The_administrative_factory_refuses_every_other_purpose(InvitationPurpose purpose)
    {
        var failure = Assert.Throws<ArgumentException>(() => InviteToken.CreateAdministrative(
            "admin@atlas.example", Guid.NewGuid(), Guid.NewGuid(), purpose));

        Assert.Contains("administrative", failure.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void The_canonical_workforce_factory_uses_a_hash_only_credential_and_no_raw_token()
    {
        var invitation = InviteToken.CreateWorkforce(
            "member@atlas.example", Guid.NewGuid(), "Employee", Guid.NewGuid(), employeeId: Guid.NewGuid());

        // Workforce joined the hash-only scheme in workforce-access-activation: the
        // canonical factory carries no reusable raw secret at rest, exactly like the
        // administrative journeys, and issues a selector/digest credential instead.
        Assert.Null(invitation.Token);
        Assert.True(InvitationPurposes.IsCredentialBearing(invitation.Purpose));

        var exception = Record.Exception(() => invitation.IssueCredential("selector", "digest"));
        Assert.Null(exception);
        Assert.Equal("selector", invitation.CredentialSelector);
    }

    // ── Write-site gate ──────────────────────────────────

    [Fact]
    public void No_endpoint_sets_membership_status_outside_the_continuity_boundary()
    {
        var offenders = SourceFilesWith(@"\.Suspend\(|\.Reactivate\(")
            .Where(file => !IsContinuityOwned(file))

            // A file elsewhere may still change membership status if it provably runs
            // the change inside the tenant continuity executor — the same serialization
            // and final-administrator protection the boundary owns. Workforce activation
            // reactivates a suspended membership through exactly that executor.
            .Where(file => !UsesContinuityBoundary(file))
            .ToList();

        Assert.True(offenders.Count == 0, Explain("membership status", offenders));
    }

    [Fact]
    public void No_endpoint_grants_or_revokes_canonical_authority_outside_the_continuity_boundary()
    {
        var offenders = SourceFilesWith(@"TenantAdministratorAssignment\.Grant\(|\.Revoke\(\s*(?:command|actor)")
            .Where(file => !IsContinuityOwned(file))
            .Where(file => !EstablishesFirstAdministrator(file))
            .ToList();

        // Two deliberate exceptions, both establishing a tenant's *first*
        // administrator where the invariant has nothing yet to protect: bootstrap
        // activation, inside its own transaction, and demo seeding, which builds a
        // tenant from nothing.
        Assert.True(offenders.Count == 0, Explain("canonical authority", offenders));
    }

    [Fact]
    public void No_endpoint_flips_global_account_status_outside_the_continuity_boundary()
    {
        // Disabling an account can make a Tenant Administrator unusable, so any
        // file that does it has to run inside the boundary. Matched on the
        // account variable rather than the property alone, because a tenant's own
        // IsActive is a different fact with a different lifecycle.
        var offenders = SourceFilesWith(@"(?:account|user)\.IsActive\s*=\s*(?:true|false)")
            .Where(file => !IsContinuityOwned(file))

            // Account creation, not a status change: there is no prior
            // administrator to protect when the account does not exist yet.
            .Where(file => !EstablishesNewAccounts(file))

            // The remaining files must reach the boundary themselves.
            .Where(file => !UsesContinuityBoundary(file))
            .ToList();

        Assert.True(offenders.Count == 0, Explain("global account status", offenders));
    }

    [Fact]
    public void Role_mutation_endpoints_no_longer_exist()
    {
        var controller = Path.Combine(IdentityRoot, "Controllers", "UsersController.cs");
        Skip.IfNot(File.Exists(controller), "Identity source not present next to the test binary.");

        // Global roles are derived output of canonical authority. An endpoint that
        // set them by hand could put a person's role and their real authority into
        // disagreement, outside the boundary that keeps a tenant administered.
        Assert.DoesNotContain("roles/{role}", File.ReadAllText(controller), StringComparison.Ordinal);
    }

    // ── plumbing ─────────────────────────────────────────

    /// <summary>
    /// Files allowed to perform continuity-affecting writes: the boundary itself
    /// and the commands that run inside it.
    /// </summary>
    private static bool IsContinuityOwned(string path)
        => path.Contains(Path.Combine("Features", "TenantAdministration"), StringComparison.Ordinal);

    /// <summary>
    /// Whether this file routes its writes through the tenant continuity
    /// executor. A file-level check, because the write itself sits inside the
    /// executor's callback where a pattern match cannot see it.
    /// </summary>
    private static bool UsesContinuityBoundary(string path)
    {
        var source = File.ReadAllText(path);
        return source.Contains("continuity.ExecuteAsync", StringComparison.Ordinal)
            || source.Contains("ITenantContinuityCommandExecutor", StringComparison.Ordinal);
    }

    /// <summary>
    /// Files that only ever set the flag while creating an account, where the
    /// invariant has nothing yet to protect.
    /// </summary>
    /// <summary>
    /// Files that grant authority only where a tenant has none yet, so there is no
    /// last administrator whose removal the invariant would need to refuse.
    /// </summary>
    private static bool EstablishesFirstAdministrator(string path)
        => Path.GetFileName(path) is "BootstrapActivationService.cs" or "IdentitySeeder.cs";

    private static bool EstablishesNewAccounts(string path)
        => Path.GetFileName(path) is "BootstrapActivationService.cs"
            or "AdministrativeInvitationAcceptanceService.cs"
            or "IdentitySeeder.cs"
            or "UsersController.cs";

    private static IEnumerable<string> SourceFilesWith(string pattern)
    {
        if (!Directory.Exists(IdentityRoot))
        {
            return [];
        }

        var expression = new Regex(pattern, RegexOptions.Compiled);

        return Directory
            .EnumerateFiles(IdentityRoot, "*.cs", SearchOption.AllDirectories)
            .Where(file => !file.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .Where(file => !file.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .Where(file => !file.Contains("Migrations", StringComparison.Ordinal))
            .Where(file => expression.IsMatch(File.ReadAllText(file)));
    }

    private static string Explain(string subject, IReadOnlyCollection<string> offenders)
        => $"These files write {subject} outside the tenant continuity boundary, so they can change "
           + "who administers a tenant without the final-administrator invariant being enforced: "
           + string.Join(", ", offenders.Select(Path.GetFileName));
}

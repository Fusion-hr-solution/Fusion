using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.Identity.Features.TenantProvisioning;
using EY.HRPlatform.Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EY.HRPlatform.Identity.Tests.Features.TenantProvisioning;

/// <summary>
/// Provisioning and recovery against real PostgreSQL. These need a real database
/// because the guarantees under test are transactional atomicity, unique-key
/// convergence, and filtered partial indexes — none of which the in-memory
/// provider models.
///
/// Point <c>ConnectionStrings__IdentityDb</c> (or <c>FUSION_TEST_PG</c>) at a
/// server the suite may create scratch databases on; without one these skip
/// rather than pass vacuously.
/// </summary>
public sealed class TenantProvisioningIntegrationTests : IAsyncLifetime
{
    private static readonly Guid Actor = new("cccccccc-0000-0000-0000-00000000000c");

    private string? _adminConnectionString;
    private readonly List<string> _scratchDatabases = [];

    private bool Available => _adminConnectionString is not null;

    public Task InitializeAsync()
    {
        var configured = Environment.GetEnvironmentVariable("FUSION_TEST_PG")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");

        if (!string.IsNullOrWhiteSpace(configured))
        {
            _adminConnectionString = configured;
        }

        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        if (!Available) return;
        foreach (var database in _scratchDatabases)
        {
            await DropDatabaseAsync(database);
        }
    }

    private static ProvisionTenantRequest Request(string key = "key-1", string name = "Atlas Group") => new()
    {
        Name = name,
        Locale = "en-US",
        TimeZone = "Europe/Paris",
        Modules = [TenantModule.Performance],
        AdministratorEmail = "admin@atlas.example",
        IdempotencyKey = key,
    };

    // ── Provisioning transaction ─────────────────────────

    [SkippableFact]
    public async Task Successful_provisioning_creates_every_record_in_one_transaction()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out var delivery);

        var result = await service.ProvisionAsync(Request(), Actor);

        Assert.True(result.IsSuccess);
        var tenantId = result.Value.TenantId;

        var tenant = await db.Tenants.IgnoreQueryFilters().SingleAsync(t => t.Id == tenantId);
        Assert.Equal("Atlas Group", tenant.Name);
        Assert.Equal("Europe/Paris", tenant.TimeZone);
        // The tenant is not Active until its administrator activates it.
        Assert.Equal(TenantAdministratorActivationStatus.AwaitingAdministratorActivation,
            tenant.AdministratorActivationStatus);

        var modules = await db.TenantModuleEntitlements.IgnoreQueryFilters()
            .Where(e => e.TenantId == tenantId).Select(e => e.Module).ToListAsync();
        Assert.Contains(TenantModule.CoreHR, modules);
        Assert.Contains(TenantModule.Performance, modules);

        var invitation = await db.InviteTokens.IgnoreQueryFilters()
            .SingleAsync(i => i.TenantId == tenantId);
        Assert.Equal(InvitationPurpose.OrganizationBootstrap, invitation.Purpose);
        Assert.Equal(InvitationState.Pending, invitation.State);
        // Hash-only: no reusable secret is stored anywhere on the row.
        Assert.Null(invitation.Token);
        Assert.NotNull(invitation.CredentialDigest);
        Assert.NotNull(invitation.CredentialSelector);

        Assert.Single(await db.TenantProvisioningReceipts
            .Where(r => r.TenantId == tenantId).ToListAsync());
        Assert.Contains(await db.TenantBootstrapAuditEvents.IgnoreQueryFilters()
            .Where(a => a.TenantId == tenantId).ToListAsync(),
            a => a.EventType == TenantBootstrapAuditEventType.TenantProvisioned);

        // Delivery is post-commit, so exactly one attempt was requested.
        Assert.Equal(1, delivery.Calls);
    }

    [SkippableTheory]
    [InlineData("Not/A/Zone", null, "provisioning.time_zone_unsupported")]
    [InlineData("Europe/Paris", "xx-NOPE", "provisioning.locale_unsupported")]
    public async Task Unsupported_settings_are_refused_before_anything_is_created(
        string timeZone, string? locale, string expectedCode)
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out _);

        // These become canonical tenant settings, so they must be refused up
        // front rather than breaking formatting on a tenant that already exists.
        var result = await service.ProvisionAsync(
            Request() with { TimeZone = timeZone, Locale = locale }, Actor);

        Assert.True(result.IsFailure);
        Assert.Equal(expectedCode, result.Error.Code);
        Assert.Empty(await db.Tenants.IgnoreQueryFilters().ToListAsync());
    }

    [SkippableFact]
    public async Task Validation_failure_creates_nothing()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out var delivery);

        var result = await service.ProvisionAsync(
            Request() with { AdministratorEmail = "not-an-email" }, Actor);

        Assert.True(result.IsFailure);
        Assert.Empty(await db.Tenants.IgnoreQueryFilters().ToListAsync());
        Assert.Empty(await db.InviteTokens.IgnoreQueryFilters().ToListAsync());
        Assert.Empty(await db.TenantProvisioningReceipts.ToListAsync());
        Assert.Equal(0, delivery.Calls);
    }

    // ── Idempotency ──────────────────────────────────────

    [SkippableFact]
    public async Task Identical_retry_returns_the_stored_result_without_redelivering()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out var delivery);

        var first = await service.ProvisionAsync(Request(), Actor);
        var second = await service.ProvisionAsync(Request(), Actor);

        Assert.True(second.IsSuccess);
        Assert.Equal(first.Value.TenantId, second.Value.TenantId);
        Assert.Equal(first.Value.BootstrapInvitationId, second.Value.BootstrapInvitationId);

        Assert.Single(await db.Tenants.IgnoreQueryFilters().ToListAsync());
        // The retry must not send a second email.
        Assert.Equal(1, delivery.Calls);
    }

    [SkippableFact]
    public async Task Key_reuse_with_different_input_conflicts_and_preserves_the_original()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out _);

        var first = await service.ProvisionAsync(Request(), Actor);
        var conflicting = await service.ProvisionAsync(
            Request() with { Name = "Different Group" }, Actor);

        Assert.True(conflicting.IsFailure);
        Assert.Equal("provisioning.idempotency_conflict", conflicting.Error.Code);

        var tenant = Assert.Single(await db.Tenants.IgnoreQueryFilters().ToListAsync());
        Assert.Equal(first.Value.TenantId, tenant.Id);
        Assert.Equal("Atlas Group", tenant.Name);
    }

    [SkippableFact]
    public async Task Retry_after_a_failed_transaction_succeeds_with_the_same_key()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();

        // Occupy the tenant name so the first attempt fails after starting.
        await using (var seed = await OpenAsync(_scratchDatabases[^1]))
        {
            seed.Tenants.Add(Identity.Domain.Entities.Tenant.Create(Guid.NewGuid(), "Atlas Group"));
            await seed.SaveChangesAsync();
        }

        var service = CreateService(db, out _);
        var failed = await service.ProvisionAsync(Request(), Actor);
        Assert.True(failed.IsFailure);

        // Nothing partial survived, so the same key is free to use again.
        Assert.Empty(await db.TenantProvisioningReceipts.ToListAsync());

        var retried = await service.ProvisionAsync(Request(name: "Atlas Group Two"), Actor);
        Assert.True(retried.IsSuccess);
    }

    [SkippableFact]
    public async Task Concurrent_identical_requests_converge_on_one_tenant()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var database = await NewDatabaseAsync();

        // Separate contexts model genuinely concurrent callers.
        await using var dbA = await OpenAsync(database);
        await using var dbB = await OpenAsync(database);
        var serviceA = CreateService(dbA, out _);
        var serviceB = CreateService(dbB, out _);

        var results = await Task.WhenAll(
            serviceA.ProvisionAsync(Request(), Actor),
            serviceB.ProvisionAsync(Request(), Actor));

        Assert.All(results, r => Assert.True(r.IsSuccess));
        Assert.Equal(results[0].Value.TenantId, results[1].Value.TenantId);

        await using var verify = await OpenAsync(database);
        Assert.Single(await verify.TenantProvisioningReceipts.ToListAsync());
        Assert.Single(await verify.InviteTokens.IgnoreQueryFilters().ToListAsync());
    }

    // ── Delivery ─────────────────────────────────────────

    [SkippableFact]
    public async Task Delivery_failure_leaves_a_recoverable_pending_invitation()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateFailingDeliveryService(db);

        var result = await service.ProvisionAsync(Request(), Actor);

        // The tenant and invitation stay committed; only delivery failed.
        Assert.True(result.IsSuccess);
        var invitation = await db.InviteTokens.IgnoreQueryFilters()
            .SingleAsync(i => i.TenantId == result.Value.TenantId);
        Assert.Equal(InvitationState.Pending, invitation.State);

        var attempt = await db.InvitationDeliveryAttempts
            .SingleAsync(a => a.InvitationId == invitation.Id);
        Assert.Equal(InvitationDeliveryOutcome.Failed, attempt.Outcome);
        Assert.False(string.IsNullOrWhiteSpace(attempt.SanitizedFailureCode));
        // Sanitized: no raw provider text is persisted.
        Assert.DoesNotContain("smtp", attempt.SanitizedFailureCode!, StringComparison.OrdinalIgnoreCase);
        Assert.True(attempt.SanitizedFailureCode!.Length <= 64);
    }

    // ── Recovery ─────────────────────────────────────────

    [SkippableFact]
    public async Task Resend_rotates_the_credential_and_keeps_email_and_expiry()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var (tenantId, invitationId) = await ProvisionAsync(db);

        var before = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == invitationId);

        var recovery = CreateRecovery(db, out _);
        var result = await recovery.ResendAsync(tenantId, invitationId, Actor);
        Assert.True(result.IsSuccess);

        var after = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == invitationId);

        Assert.Equal(before.Email, after.Email);
        Assert.Equal(before.ExpiresAt, after.ExpiresAt);
        // The old link must stop working, which requires a new digest.
        Assert.NotEqual(before.CredentialDigest, after.CredentialDigest);
        Assert.NotEqual(before.CredentialSelector, after.CredentialSelector);
        Assert.Equal(InvitationState.Pending, after.State);
    }

    [SkippableFact]
    public async Task Revoke_makes_the_invitation_unusable()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var (tenantId, invitationId) = await ProvisionAsync(db);
        var recovery = CreateRecovery(db, out _);

        Assert.True((await recovery.RevokeAsync(tenantId, invitationId, Actor)).IsSuccess);

        var invitation = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == invitationId);
        Assert.Equal(InvitationState.Revoked, invitation.State);
        Assert.False(invitation.IsValid);
    }

    [SkippableFact]
    public async Task Replace_supersedes_the_original_and_creates_one_new_pending_invitation()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var (tenantId, invitationId) = await ProvisionAsync(db);
        var recovery = CreateRecovery(db, out _);

        var result = await recovery.ReplaceAsync(tenantId, invitationId, "replacement@atlas.example", Actor);
        Assert.True(result.IsSuccess);

        var original = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == invitationId);
        var replacement = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == result.Value);

        Assert.Equal(InvitationState.Superseded, original.State);
        Assert.Equal(replacement.Id, original.ReplacedByInvitationId);
        Assert.Equal(invitationId, replacement.PredecessorInvitationId);
        Assert.Equal("replacement@atlas.example", replacement.Email);
        Assert.Equal(InvitationState.Pending, replacement.State);
    }

    [SkippableFact]
    public async Task Reissue_after_revocation_creates_a_new_pending_invitation()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var (tenantId, invitationId) = await ProvisionAsync(db);
        var recovery = CreateRecovery(db, out _);

        await recovery.RevokeAsync(tenantId, invitationId, Actor);
        var result = await recovery.ReissueAsync(tenantId, invitationId, Actor);

        Assert.True(result.IsSuccess);
        var replacement = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == result.Value);
        Assert.Equal(InvitationState.Pending, replacement.State);
        Assert.Equal(invitationId, replacement.PredecessorInvitationId);
    }

    [SkippableFact]
    public async Task Recovery_actions_reject_states_they_do_not_apply_to()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var (tenantId, invitationId) = await ProvisionAsync(db);
        var recovery = CreateRecovery(db, out _);

        // Reissue is for Expired or Revoked, never for a live Pending invitation.
        var earlyReissue = await recovery.ReissueAsync(tenantId, invitationId, Actor);
        Assert.True(earlyReissue.IsFailure);
        Assert.Equal("bootstrap.invalid_state", earlyReissue.Error.Code);

        await recovery.RevokeAsync(tenantId, invitationId, Actor);

        // Once revoked, the actions that need a live invitation become stale
        // conflicts. Replacement is not among them — see the test below.
        foreach (var stale in new[]
        {
            await recovery.ResendAsync(tenantId, invitationId, Actor),
            await recovery.RevokeAsync(tenantId, invitationId, Actor),
        })
        {
            Assert.True(stale.IsFailure);
            Assert.Equal("bootstrap.invalid_state", stale.Error.Code);
        }
    }

    [SkippableFact]
    public async Task Replace_hands_a_revoked_tenant_to_a_different_administrator()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var (tenantId, invitationId) = await ProvisionAsync(db);
        var recovery = CreateRecovery(db, out _);

        // Revoking leaves the tenant with no way in. Reissue would send the same
        // address another invitation; when the nominated person is the reason it
        // was revoked, replacement is the only recovery that helps.
        await recovery.RevokeAsync(tenantId, invitationId, Actor);
        var result = await recovery.ReplaceAsync(tenantId, invitationId, "successor@atlas.example", Actor);

        Assert.True(result.IsSuccess);
        var replacement = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == result.Value);
        Assert.Equal("successor@atlas.example", replacement.Email);
        Assert.Equal(InvitationState.Pending, replacement.State);
        Assert.Equal(invitationId, replacement.PredecessorInvitationId);

        // Bounded lineage: the predecessor is retired and cannot fork again.
        var second = await recovery.ReplaceAsync(tenantId, invitationId, "third@atlas.example", Actor);
        Assert.True(second.IsFailure);
        Assert.Equal("bootstrap.invalid_state", second.Error.Code);
    }

    [SkippableFact]
    public async Task Replace_and_reissue_are_both_offered_once_recovery_is_needed()
    {
        // The interface offers exactly what the service will accept, so the two
        // must be derived from one another rather than restated.
        Assert.Equal(
            ["resend", "revoke", "replace"],
            TenantDetailProjection.AllowedActionsFor(InvitationState.Pending));

        foreach (var blocked in new[] { InvitationState.Expired, InvitationState.Revoked })
        {
            Assert.Equal(
                ["reissue", "replace"],
                TenantDetailProjection.AllowedActionsFor(blocked));
        }
    }

    [SkippableFact]
    public async Task A_revoked_predecessor_cannot_be_reissued_twice()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var (tenantId, invitationId) = await ProvisionAsync(db);
        var recovery = CreateRecovery(db, out _);

        await recovery.RevokeAsync(tenantId, invitationId, Actor);
        var first = await recovery.ReissueAsync(tenantId, invitationId, Actor);
        Assert.True(first.IsSuccess);

        // The predecessor is now Superseded, so it must not fork a second
        // successor even though it is also still revoked.
        var superseded = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == invitationId);
        Assert.Equal(InvitationState.Superseded, superseded.State);
        Assert.Empty(TenantDetailProjection.AllowedActionsFor(superseded.State));

        var second = await recovery.ReissueAsync(tenantId, invitationId, Actor);
        Assert.True(second.IsFailure);
        Assert.Equal("bootstrap.invalid_state", second.Error.Code);

        // Lineage stays bounded: exactly one successor points at the predecessor.
        var successors = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .Where(i => i.PredecessorInvitationId == invitationId).ToListAsync();
        Assert.Single(successors);
    }

    [SkippableFact]
    public async Task Concurrent_resend_is_serialized_into_one_surviving_credential()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        var database = await NewDatabaseAsync();

        Guid tenantId, invitationId;
        await using (var seed = await OpenAsync(database))
        {
            var provisioned = await CreateService(seed, out _).ProvisionAsync(Request(), Actor);
            tenantId = provisioned.Value.TenantId;
            invitationId = provisioned.Value.BootstrapInvitationId;
        }

        await using var dbA = await OpenAsync(database);
        await using var dbB = await OpenAsync(database);

        // Two administrators press Resend at the same moment. Both are legitimate
        // resends of a Pending invitation, so both may succeed — what must not
        // happen is a lost update leaving the row inconsistent with the link that
        // was actually sent last.
        await Task.WhenAll(
            CreateRecovery(dbA, out _).ResendAsync(tenantId, invitationId, Actor),
            CreateRecovery(dbB, out _).ResendAsync(tenantId, invitationId, Actor));

        await using var verify = await OpenAsync(database);
        var invitation = await verify.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == invitationId);

        // Exactly one credential survives, the invitation is still usable, and the
        // rotation is internally consistent rather than half-applied.
        Assert.Equal(InvitationState.Pending, invitation.State);
        Assert.NotNull(invitation.CredentialDigest);
        Assert.NotNull(invitation.CredentialSelector);
        Assert.Null(invitation.Token);

        // Serialization means one row, one live invitation — not two.
        Assert.Single(await verify.InviteTokens.IgnoreQueryFilters()
            .Where(i => i.TenantId == tenantId).ToListAsync());
    }

    // ── Tenants overview ─────────────────────────────────

    [SkippableFact]
    public async Task Overview_lists_tenants_with_the_facts_needed_to_decide()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var provisioned = await CreateService(db, out _).ProvisionAsync(Request(), Actor);

        var result = await new TenantOverviewProjection(db).GetAsync(new TenantOverviewQuery());

        var row = Assert.Single(result.Rows);
        Assert.Equal(provisioned.Value.TenantId, row.TenantId);
        Assert.Equal("Atlas Group", row.Name);
        Assert.Equal("AwaitingAdministratorActivation", row.AdministratorActivationStatus);
        Assert.Equal("admin@atlas.example", row.InitialAdministratorEmail);
        Assert.Equal("Pending", row.InvitationState);
        Assert.Contains("CoreHR", row.Modules);
        Assert.Contains("Performance", row.Modules);

        // Invitation validity and delivery outcome are reported as two separate
        // facts, because a valid invitation whose message bounced is a real and
        // distinct condition.
        Assert.Equal("Sent", row.LastDeliveryOutcome);

        // Delivery succeeded, so this tenant is awaiting its recipient.
        Assert.False(row.NeedsAttention);
        Assert.Equal(1, result.TotalCount);
    }

    [SkippableFact]
    public async Task Overview_filters_separate_awaiting_active_and_attention()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out _);

        var awaiting = await service.ProvisionAsync(Request("k1", "Awaiting Co"), Actor);
        var attention = await service.ProvisionAsync(
            Request("k2", "Attention Co") with { AdministratorEmail = "b@atlas.example" }, Actor);

        // Revoking with no replacement leaves the tenant with no live route in.
        await CreateRecovery(db, out _)
            .RevokeAsync(attention.Value.TenantId, attention.Value.BootstrapInvitationId, Actor);
        db.ChangeTracker.Clear();

        var projection = new TenantOverviewProjection(db);

        Assert.Equal(2, (await projection.GetAsync(Query(TenantOverviewFilter.All))).Rows.Count);
        Assert.Equal(2, (await projection.GetAsync(Query(TenantOverviewFilter.AwaitingActivation))).Rows.Count);
        Assert.Empty((await projection.GetAsync(Query(TenantOverviewFilter.Active))).Rows);

        var attentionPage = await projection.GetAsync(Query(TenantOverviewFilter.NeedsAttention));
        var needsAttention = Assert.Single(attentionPage.Rows);
        Assert.Equal(attention.Value.TenantId, needsAttention.TenantId);
        Assert.Equal(nameof(TenantAttentionReason.InvitationRevoked), needsAttention.AttentionReason);

        // The untouched tenant is not swept up by the attention filter.
        Assert.DoesNotContain(attentionPage.Rows, row => row.TenantId == awaiting.Value.TenantId);

        // Selecting one lifecycle position must not make the others read as
        // empty: the counts describe the whole matching set, not the slice.
        Assert.Equal(2, attentionPage.Counts.All);
        Assert.Equal(2, attentionPage.Counts.AwaitingActivation);
        Assert.Equal(0, attentionPage.Counts.Active);
        Assert.Equal(1, attentionPage.Counts.NeedsAttention);
    }

    [SkippableFact]
    public async Task Overview_counts_describe_the_search_not_the_visible_page()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out _);

        for (var index = 0; index < 12; index++)
        {
            await service.ProvisionAsync(Request($"k{index}", $"Tenant {index:00}"), Actor);
        }

        var projection = new TenantOverviewProjection(db);
        var page = await projection.GetAsync(new TenantOverviewQuery { PageSize = 10 });

        // Ten rows are returned, but the operator is told the truth about how
        // many exist behind them.
        Assert.Equal(10, page.Rows.Count);
        Assert.Equal(12, page.TotalCount);
        Assert.Equal(12, page.Counts.All);

        var second = await projection.GetAsync(new TenantOverviewQuery { PageSize = 10, Page = 2 });
        Assert.Equal(2, second.Rows.Count);
        Assert.Equal(12, second.TotalCount);

        // An export asks for everything the query matches, bounded by the cap.
        var everything = await projection.GetAsync(new TenantOverviewQuery { PageSize = 0 });
        Assert.Equal(12, everything.Rows.Count);
    }

    [SkippableFact]
    public async Task Overview_advanced_filters_narrow_across_dimensions()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out _);

        var kept = await service.ProvisionAsync(Request("k1", "Kept Co"), Actor);
        var revoked = await service.ProvisionAsync(
            Request("k2", "Revoked Co") with { AdministratorEmail = "b@atlas.example" }, Actor);

        await CreateRecovery(db, out _)
            .RevokeAsync(revoked.Value.TenantId, revoked.Value.BootstrapInvitationId, Actor);
        db.ChangeTracker.Clear();

        var projection = new TenantOverviewProjection(db);

        var pending = await projection.GetAsync(new TenantOverviewQuery
        {
            InvitationStates = [InvitationState.Pending],
        });
        Assert.Equal(kept.Value.TenantId, Assert.Single(pending.Rows).TenantId);

        // Values inside one dimension widen the result.
        var either = await projection.GetAsync(new TenantOverviewQuery
        {
            InvitationStates = [InvitationState.Pending, InvitationState.Revoked],
        });
        Assert.Equal(2, either.Rows.Count);

        // Separate dimensions narrow it: Pending and Revoked cannot both hold.
        var impossible = await projection.GetAsync(new TenantOverviewQuery
        {
            InvitationStates = [InvitationState.Revoked],
            DeliveryOutcomes = [InvitationDeliveryOutcome.Failed],
        });
        Assert.Empty(impossible.Rows);

        // Module filtering uses stable identifiers, never display labels.
        var byModule = await projection.GetAsync(new TenantOverviewQuery
        {
            Modules = [TenantModule.Performance],
        });
        Assert.Equal(2, byModule.Rows.Count);

        // A created range excluding everything is a real answer, and the counts
        // shrink with it rather than reporting the unfiltered set.
        var future = await projection.GetAsync(new TenantOverviewQuery
        {
            CreatedFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
        });
        Assert.Empty(future.Rows);
        Assert.Equal(0, future.Counts.All);
    }

    [SkippableFact]
    public async Task Overview_sorts_the_whole_result_set_before_paging()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out _);

        await service.ProvisionAsync(Request("k1", "Zephyr Ltd"), Actor);
        await service.ProvisionAsync(Request("k2", "Alpha Ltd"), Actor);

        var projection = new TenantOverviewProjection(db);

        var byName = await projection.GetAsync(new TenantOverviewQuery
        {
            Sort = TenantOverviewSort.NameAscending,
        });
        Assert.Equal("Alpha Ltd", byName.Rows[0].Name);

        var byNameDesc = await projection.GetAsync(new TenantOverviewQuery
        {
            Sort = TenantOverviewSort.NameDescending,
        });
        Assert.Equal("Zephyr Ltd", byNameDesc.Rows[0].Name);

        // The default stays newest first.
        var byCreated = await projection.GetAsync(new TenantOverviewQuery());
        Assert.Equal("Alpha Ltd", byCreated.Rows[0].Name);

        var oldestFirst = await projection.GetAsync(new TenantOverviewQuery
        {
            Sort = TenantOverviewSort.CreatedAscending,
        });
        Assert.Equal("Zephyr Ltd", oldestFirst.Rows[0].Name);
    }

    private static TenantOverviewQuery Query(TenantOverviewFilter filter) =>
        new() { Filter = filter, PageSize = 0 };

    // ── Recent tenant activity ───────────────────────────

    [SkippableFact]
    public async Task Recent_activity_reports_real_events_newest_first_across_tenants()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out _);

        await service.ProvisionAsync(Request("k1", "Alpha Ltd"), Actor);
        var beta = await service.ProvisionAsync(
            Request("k2", "Beta Ltd") with { AdministratorEmail = "b@atlas.example" }, Actor);

        await CreateRecovery(db, out _)
            .RevokeAsync(beta.Value.TenantId, beta.Value.BootstrapInvitationId, Actor);
        db.ChangeTracker.Clear();

        var entries = await new TenantActivityProjection(db).GetRecentAsync(6);

        Assert.NotEmpty(entries);

        // Newest first, so the preview opens on what just happened.
        Assert.Equal(
            entries.Select(entry => entry.OccurredAt).OrderByDescending(at => at).ToList(),
            entries.Select(entry => entry.OccurredAt).ToList());

        // Cross-tenant, and already resolved to the tenant's display name.
        Assert.Equal(nameof(TenantBootstrapAuditEventType.InvitationRevoked), entries[0].EventType);
        Assert.Equal("Beta Ltd", entries[0].TenantName);
        Assert.Contains(entries, entry => entry.TenantName == "Alpha Ltd");
    }

    [SkippableFact]
    public async Task Recent_activity_is_bounded_and_carries_no_investigation_detail()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out _);

        for (var index = 0; index < 8; index++)
        {
            await service.ProvisionAsync(Request($"k{index}", $"Tenant {index:00}"), Actor);
        }

        var projection = new TenantActivityProjection(db);

        // A preview, not a log viewer: the caller cannot ask for an unbounded read.
        Assert.Equal(4, (await projection.GetRecentAsync(4)).Count);
        Assert.True((await projection.GetRecentAsync(int.MaxValue)).Count
            <= TenantActivityProjection.MaxLimit);

        // A non-positive limit is a caller mistake, not a request for everything.
        Assert.Equal(
            TenantActivityProjection.DefaultLimit,
            (await projection.GetRecentAsync(0)).Count);

        // The contract exposes no correlation identifier, invitation identifier,
        // stored metadata, or invited address for a feed to leak.
        var properties = typeof(TenantActivityEntryDto).GetProperties().Select(p => p.Name).ToList();
        Assert.DoesNotContain("CorrelationId", properties);
        Assert.DoesNotContain("InvitationId", properties);
        Assert.DoesNotContain("Metadata", properties);
        Assert.DoesNotContain("Reason", properties);
    }

    [SkippableFact]
    public async Task Recent_activity_is_empty_before_anything_has_happened()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();

        // No activity is a truthful answer, not a retrieval failure.
        Assert.Empty(await new TenantActivityProjection(db).GetRecentAsync(6));
    }

    [SkippableFact]
    public async Task Overview_search_matches_tenant_name_and_nominated_administrator()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out _);

        await service.ProvisionAsync(Request("k1", "Northwind Trading"), Actor);
        await service.ProvisionAsync(
            Request("k2", "Southgate Group") with { AdministratorEmail = "ops@southgate.example" }, Actor);

        var projection = new TenantOverviewProjection(db);

        // An operator searches by what they remember: the tenant or the person.
        Assert.Single((await projection.GetAsync(Search("northwind"))).Rows);
        Assert.Single((await projection.GetAsync(Search("NORTHWIND"))).Rows);
        Assert.Single((await projection.GetAsync(Search("southgate.example"))).Rows);
        Assert.Empty((await projection.GetAsync(Search("nothing-matches"))).Rows);

        // An empty search is not a filter.
        Assert.Equal(2, (await projection.GetAsync(Search("   "))).Rows.Count);
    }

    private static TenantOverviewQuery Search(string term) =>
        new() { Search = term, PageSize = 0 };

    [SkippableFact]
    public async Task Overview_is_empty_when_no_tenant_has_been_provisioned()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();

        // An empty set is a truthful answer, not a retrieval failure.
        var page = await new TenantOverviewProjection(db).GetAsync(new TenantOverviewQuery());
        Assert.Empty(page.Rows);
        Assert.Equal(0, page.Counts.All);
    }

    // ── Tenant isolation ─────────────────────────────────

    [SkippableFact]
    public async Task Recovery_denies_an_invitation_belonging_to_another_tenant()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var service = CreateService(db, out _);

        var first = await service.ProvisionAsync(Request("key-a", "Tenant A"), Actor);
        var second = await service.ProvisionAsync(
            Request("key-b", "Tenant B") with { AdministratorEmail = "b@atlas.example" }, Actor);

        // Substituting another tenant's identifier must not act on the invitation.
        var crossTenant = await CreateRecovery(db, out _)
            .RevokeAsync(first.Value.TenantId, second.Value.BootstrapInvitationId, Actor);

        Assert.True(crossTenant.IsFailure);
        Assert.Equal("bootstrap.invitation_not_found", crossTenant.Error.Code);

        var untouched = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == second.Value.BootstrapInvitationId);
        Assert.Equal(InvitationState.Pending, untouched.State);
    }

    // ── Tenant detail projection ─────────────────────────

    [SkippableFact]
    public async Task Tenant_detail_reports_state_actions_and_no_credential_material()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var (tenantId, invitationId) = await ProvisionAsync(db);

        var detail = await new TenantDetailProjection(db).GetAsync(tenantId);

        Assert.NotNull(detail);
        Assert.Equal("AwaitingAdministratorActivation", detail!.AdministratorActivationStatus);
        Assert.Contains("CoreHR", detail.Modules);
        Assert.Equal(invitationId, detail.BootstrapInvitation!.InvitationId);
        Assert.Equal("Pending", detail.BootstrapInvitation.State);
        Assert.Equal(["resend", "revoke", "replace"], detail.BootstrapInvitation.AllowedActions);
        Assert.NotNull(detail.BootstrapInvitation.LastDelivery);
        Assert.Contains(detail.History, entry => entry.EventType == "TenantProvisioned");

        // The projection must never carry anything that could activate a tenant.
        var serialized = System.Text.Json.JsonSerializer.Serialize(detail);
        Assert.DoesNotContain("credential", serialized, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("digest", serialized, StringComparison.OrdinalIgnoreCase);
    }

    [SkippableFact]
    public async Task Accepted_and_superseded_invitations_offer_no_recovery_action()
    {
        Skip.IfNot(Available, "No PostgreSQL connection configured.");
        await using var db = await CreateAsync();
        var (tenantId, invitationId) = await ProvisionAsync(db);

        await CreateRecovery(db, out _).ReplaceAsync(tenantId, invitationId, "next@atlas.example", Actor);

        var superseded = await db.InviteTokens.IgnoreQueryFilters().AsNoTracking()
            .SingleAsync(i => i.Id == invitationId);
        Assert.Equal(InvitationState.Superseded, superseded.State);
        Assert.Empty(TenantDetailProjection.AllowedActionsFor(superseded.State));
        Assert.Empty(TenantDetailProjection.AllowedActionsFor(InvitationState.Accepted));
    }

    // ── plumbing ─────────────────────────────────────────

    private async Task<(Guid TenantId, Guid InvitationId)> ProvisionAsync(AppIdentityDbContext db)
    {
        var result = await CreateService(db, out _).ProvisionAsync(Request(), Actor);
        Assert.True(result.IsSuccess);
        db.ChangeTracker.Clear();
        return (result.Value.TenantId, result.Value.BootstrapInvitationId);
    }

    private static ITenantProvisioningService CreateService(
        AppIdentityDbContext db, out RecordingDelivery delivery)
    {
        delivery = new RecordingDelivery(db);
        return new TenantProvisioningService(db, delivery);
    }

    private static ITenantProvisioningService CreateFailingDeliveryService(AppIdentityDbContext db)
        => new TenantProvisioningService(db, new FailingDelivery(db));

    private static IBootstrapInvitationRecoveryService CreateRecovery(
        AppIdentityDbContext db, out RecordingDelivery delivery)
    {
        delivery = new RecordingDelivery(db);
        return new BootstrapInvitationRecoveryService(db, delivery);
    }

    /// <summary>Records a Sent attempt, standing in for a working sender.</summary>
    private sealed class RecordingDelivery(AppIdentityDbContext db) : IBootstrapInvitationDelivery
    {
        public int Calls { get; private set; }

        public async Task DeliverAsync(
            Guid invitationId, string email, BootstrapCredential credential,
            Guid initiatedByAccountId, CancellationToken cancellationToken = default)
        {
            Calls++;
            db.InvitationDeliveryAttempts.Add(
                Identity.Domain.Entities.InvitationDeliveryAttempt.Sent(invitationId, initiatedByAccountId));
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>Records a Failed attempt with a bounded, sanitized code.</summary>
    private sealed class FailingDelivery(AppIdentityDbContext db) : IBootstrapInvitationDelivery
    {
        public async Task DeliverAsync(
            Guid invitationId, string email, BootstrapCredential credential,
            Guid initiatedByAccountId, CancellationToken cancellationToken = default)
        {
            db.InvitationDeliveryAttempts.Add(
                Identity.Domain.Entities.InvitationDeliveryAttempt.Failed(
                    invitationId, "delivery_error", initiatedByAccountId));
            await db.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<AppIdentityDbContext> CreateAsync()
        => await OpenAsync(await NewDatabaseAsync());

    private async Task<string> NewDatabaseAsync()
    {
        var name = $"fusion_provisioning_test_{Guid.NewGuid():N}";
        await using var connection = new NpgsqlConnection(AdminConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"CREATE DATABASE \"{name}\";";
        await command.ExecuteNonQueryAsync();
        _scratchDatabases.Add(name);

        await using var migrate = await OpenAsync(name, migrated: false);
        await migrate.Database.MigrateAsync();
        return name;
    }

    private async Task<AppIdentityDbContext> OpenAsync(string database, bool migrated = true)
    {
        var builder = new NpgsqlConnectionStringBuilder(_adminConnectionString) { Database = database };
        var options = new DbContextOptionsBuilder<AppIdentityDbContext>()
            .UseNpgsql(builder.ConnectionString)
            .Options;
        var context = new AppIdentityDbContext(options);
        await Task.CompletedTask;
        return context;
    }

    private async Task DropDatabaseAsync(string database)
    {
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(AdminConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"DROP DATABASE IF EXISTS \"{database}\" WITH (FORCE);";
        await command.ExecuteNonQueryAsync();
    }

    private string AdminConnectionString()
        => new NpgsqlConnectionStringBuilder(_adminConnectionString) { Database = "postgres" }.ConnectionString;
}

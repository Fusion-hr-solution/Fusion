using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Cuts customer tenancy over from account-owned tenant references to explicit
    /// memberships, and adds the tenant settings, entitlement, invitation
    /// credential, receipt, delivery, continuation, and bootstrap audit
    /// persistence.
    ///
    /// The sequence is deliberate:
    ///   1. assert every precondition and abort with actionable identifiers;
    ///   2. create the new structures;
    ///   3. backfill deterministically;
    ///   4. assert the backfill converged before enforcing the new constraints.
    ///
    /// Contradictory source data aborts the migration. Nothing is silently
    /// repaired, quarantined, or invented.
    /// </summary>
    public partial class AddTenantMembershipAndBootstrapPersistence : Migration
    {
        /// <summary>Identifies Platform Administrators, who must hold zero customer memberships.</summary>
        private const string PlatformAdminAccountsSql = """
            SELECT ur."UserId"
            FROM identity."AspNetUserRoles" ur
            JOIN identity."AspNetRoles" r ON r."Id" = ur."RoleId"
            WHERE r."NormalizedName" = 'PLATFORMADMIN'
            """;

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            AssertPreconditions(migrationBuilder);

            CreateBootstrapStructures(migrationBuilder);

            BackfillMemberships(migrationBuilder);

            BindAccessAssignmentsToMemberships(migrationBuilder);

            BackfillTenantSettingsAndEntitlements(migrationBuilder);

            MigrateInvitationsToPurposeBoundCredentials(migrationBuilder);

            ApplyNewConstraints(migrationBuilder);

            AssertBackfillConverged(migrationBuilder);
        }

        /// <summary>
        /// Fail-fast gate. Every check names the offending rows so an operator can
        /// resolve the contradiction rather than guess at it.
        /// </summary>
        private static void AssertPreconditions(MigrationBuilder migrationBuilder)
        {
            // An account whose tenant reference is empty has no derivable membership.
            migrationBuilder.Sql($"""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(format('account=%s', u."Id"), '; ')
                    INTO offenders
                    FROM identity."AspNetUsers" u
                    WHERE u."TenantId" = '00000000-0000-0000-0000-000000000000';

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Membership backfill aborted: accounts have an empty tenant reference (%). Assign each account to a real tenant, or remove it, before migrating.', offenders;
                    END IF;
                END $$;
                """);

            // A tenant reference pointing at a missing tenant cannot be converted.
            migrationBuilder.Sql($"""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(format('account=%s tenant=%s', u."Id", u."TenantId"), '; ')
                    INTO offenders
                    FROM identity."AspNetUsers" u
                    LEFT JOIN identity."Tenants" t ON t."Id" = u."TenantId"
                    WHERE t."Id" IS NULL;

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Membership backfill aborted: accounts reference tenants that do not exist (%). Restore the tenant, or remove the account, before migrating.', offenders;
                    END IF;
                END $$;
                """);

            // Platform Administrator status must never imply customer access.
            migrationBuilder.Sql($"""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(DISTINCT format('account=%s tenant=%s', uap."UserId", uap."TenantId"), '; ')
                    INTO offenders
                    FROM identity."UserAccessProfiles" uap
                    WHERE uap."UserId" IN ({PlatformAdminAccountsSql});

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Membership backfill aborted: Platform Administrator accounts hold customer access assignments (%). Remove the assignments, or the Platform Administrator role, before migrating.', offenders;
                    END IF;
                END $$;
                """);

            // An assignment whose tenant disagrees with its account has no single
            // truthful membership to bind to.
            migrationBuilder.Sql($"""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(format('account=%s assignmentTenant=%s accountTenant=%s', uap."UserId", uap."TenantId", u."TenantId"), '; ')
                    INTO offenders
                    FROM identity."UserAccessProfiles" uap
                    JOIN identity."AspNetUsers" u ON u."Id" = uap."UserId"
                    WHERE uap."TenantId" <> u."TenantId";

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Membership backfill aborted: access assignments contradict account tenancy (%). Resolve the correct tenant for each account before migrating.', offenders;
                    END IF;
                END $$;
                """);

            // An access assignment for an account that no longer exists cannot be
            // bound to a membership.
            migrationBuilder.Sql($"""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(format('account=%s profile=%s', uap."UserId", uap."AccessProfileId"), '; ')
                    INTO offenders
                    FROM identity."UserAccessProfiles" uap
                    LEFT JOIN identity."AspNetUsers" u ON u."Id" = uap."UserId"
                    WHERE u."Id" IS NULL;

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Membership backfill aborted: access assignments reference accounts that do not exist (%). Remove the orphaned assignments before migrating.', offenders;
                    END IF;
                END $$;
                """);

            // The assignment must not point at a profile owned by another tenant,
            // or the tenant-safe composite foreign key added below cannot hold.
            migrationBuilder.Sql("""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(format('account=%s profile=%s assignmentTenant=%s profileTenant=%s', uap."UserId", uap."AccessProfileId", uap."TenantId", ap."TenantId"), '; ')
                    INTO offenders
                    FROM identity."UserAccessProfiles" uap
                    LEFT JOIN identity."AccessProfiles" ap ON ap."Id" = uap."AccessProfileId"
                    WHERE ap."Id" IS NULL OR ap."TenantId" <> uap."TenantId";

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Membership backfill aborted: access assignments reference missing or cross-tenant access profiles (%). Reassign them within their own tenant before migrating.', offenders;
                    END IF;
                END $$;
                """);

            // An OrgAdmin invitation carrying an employee link is not ambiguous: the
            // dormant bootstrap path never sets an employee, so the link positively
            // identifies the workforce flow. Those rows classify as
            // WorkforceAccount below and keep their credential.

            // A live OrgAdmin invitation without an employee link has exactly the
            // same shape whether it came from the dormant Platform bootstrap path
            // or from the ordinary workforce path, which also permits OrgAdmin with
            // no employee link. Classifying by shape would silently retire a
            // legitimate workforce invitation and destroy its credential, so an
            // operator resolves these explicitly instead.
            migrationBuilder.Sql("""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(format('invitation=%s tenant=%s email=%s', i."Id", i."TenantId", i."Email"), '; ')
                    INTO offenders
                    FROM identity."InviteTokens" i
                    WHERE i."Role" = 'OrgAdmin'
                      AND i."EmployeeId" IS NULL
                      AND i."AcceptedAt" IS NULL
                      AND i."IsRevoked" = false;

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Invitation migration aborted: live OrgAdmin invitations without an employee link cannot be distinguished from workforce invitations (%). Revoke the retired bootstrap invitations, or link the workforce ones to their employee, before migrating.', offenders;
                    END IF;
                END $$;
                """);

            // Invitations must reference a real tenant to be classified at all.
            migrationBuilder.Sql("""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(format('invitation=%s tenant=%s', i."Id", i."TenantId"), '; ')
                    INTO offenders
                    FROM identity."InviteTokens" i
                    LEFT JOIN identity."Tenants" t ON t."Id" = i."TenantId"
                    WHERE t."Id" IS NULL;

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Invitation migration aborted: invitations reference tenants that do not exist (%). Remove the orphaned invitations before migrating.', offenders;
                    END IF;
                END $$;
                """);
        }

        private static void CreateBootstrapStructures(MigrationBuilder migrationBuilder)
        {
            // The legacy profile foreign key cascades, so deleting an access
            // profile would erase the assignment history recording who held it.
            // It is replaced below by a tenant-safe, restricted composite key.
            migrationBuilder.DropForeignKey(
                name: "FK_UserAccessProfiles_AccessProfiles_AccessProfileId",
                schema: "identity",
                table: "UserAccessProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_UserAccessProfiles_AspNetUsers_UserId",
                schema: "identity",
                table: "UserAccessProfiles");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_Email_Pending",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_Token",
                schema: "identity",
                table: "InviteTokens");

            // Nullable for now. It becomes NOT NULL only after the backfill is
            // proven complete, so a partial conversion can never be mistaken for a
            // finished one.
            migrationBuilder.AddColumn<Guid>(
                name: "TenantMembershipId",
                schema: "identity",
                table: "UserAccessProfiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AdministratorActivationStatus",
                schema: "identity",
                table: "Tenants",
                type: "character varying(48)",
                maxLength: 48,
                nullable: false,
                defaultValue: "AwaitingAdministratorActivation");

            migrationBuilder.AddColumn<string>(
                name: "Locale",
                schema: "identity",
                table: "Tenants",
                type: "character varying(35)",
                maxLength: 35,
                nullable: false,
                defaultValue: "en-US");

            migrationBuilder.AddColumn<string>(
                name: "TimeZone",
                schema: "identity",
                table: "Tenants",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "UTC");

            // Bootstrap invitations hold no raw secret at rest, so the legacy
            // workforce token becomes optional.
            migrationBuilder.AlterColumn<string>(
                name: "Token",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64);

            migrationBuilder.AddColumn<string>(
                name: "CredentialDigest",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CredentialIssuedAt",
                schema: "identity",
                table: "InviteTokens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CredentialSelector",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PredecessorInvitationId",
                schema: "identity",
                table: "InviteTokens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Purpose",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(48)",
                maxLength: 48,
                nullable: false,
                defaultValue: "WorkforceAccount");

            migrationBuilder.AddColumn<Guid>(
                name: "ReplacedByInvitationId",
                schema: "identity",
                table: "InviteTokens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SupersededAt",
                schema: "identity",
                table: "InviteTokens",
                type: "timestamp with time zone",
                nullable: true);

            // Alternate keys so dependants can reference these rows through
            // tenant-safe composite foreign keys.
            migrationBuilder.AddUniqueConstraint(
                name: "AK_InviteTokens_Id_TenantId",
                schema: "identity",
                table: "InviteTokens",
                columns: new[] { "Id", "TenantId" });

            migrationBuilder.AddUniqueConstraint(
                name: "AK_AccessProfiles_Id_TenantId",
                schema: "identity",
                table: "AccessProfiles",
                columns: new[] { "Id", "TenantId" });

            migrationBuilder.CreateTable(
                name: "TenantMemberships",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeactivatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantMemberships", x => x.Id);
                    table.UniqueConstraint("AK_TenantMemberships_Id_UserId_TenantId", x => new { x.Id, x.UserId, x.TenantId });
                    table.ForeignKey(
                        name: "FK_TenantMemberships_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "identity",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TenantMemberships_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "identity",
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TenantModuleEntitlements",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Module = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantModuleEntitlements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantModuleEntitlements_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "identity",
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvitationActivationContinuations",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvitationId = table.Column<Guid>(type: "uuid", nullable: false),
                    HandleDigest = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConsumedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvitationActivationContinuations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InvitationActivationContinuations_InviteTokens_InvitationId",
                        column: x => x.InvitationId,
                        principalSchema: "identity",
                        principalTable: "InviteTokens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvitationDeliveryAttempts",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvitationId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Outcome = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    SanitizedFailureCode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    InitiatedByAccountId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvitationDeliveryAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InvitationDeliveryAttempts_InviteTokens_InvitationId",
                        column: x => x.InvitationId,
                        principalSchema: "identity",
                        principalTable: "InviteTokens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Bootstrap history outlives the records it describes, so it carries no
            // foreign key that could cascade it away.
            migrationBuilder.CreateTable(
                name: "TenantBootstrapAuditEvents",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventType = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvitationId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Outcome = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Reason = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CorrelationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Metadata = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantBootstrapAuditEvents", x => x.Id);
                });

            // The receipt is the authoritative idempotency result, so it may not
            // name a missing tenant or an invitation owned by another tenant.
            migrationBuilder.CreateTable(
                name: "TenantProvisioningReceipts",
                schema: "identity",
                columns: table => new
                {
                    IdempotencyKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RequestFingerprint = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BootstrapInvitationId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    // The idempotency key is the receipt's identity; a surrogate key
                    // would create a second way to name one completed result.
                    table.PrimaryKey("PK_TenantProvisioningReceipts", x => x.IdempotencyKey);
                    table.ForeignKey(
                        name: "FK_TenantProvisioningReceipts_InviteTokens_BootstrapInvitation~",
                        columns: x => new { x.BootstrapInvitationId, x.TenantId },
                        principalSchema: "identity",
                        principalTable: "InviteTokens",
                        principalColumns: new[] { "Id", "TenantId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TenantProvisioningReceipts_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "identity",
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });
        }

        /// <summary>
        /// Converts every legitimate account tenant reference into exactly one
        /// Active membership. Platform Administrators are deliberately excluded and
        /// receive no customer membership.
        /// </summary>
        private static void BackfillMemberships(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"""
                INSERT INTO identity."TenantMemberships" ("Id", "UserId", "TenantId", "Status", "CreatedAt", "DeactivatedAt")
                SELECT gen_random_uuid(), u."Id", u."TenantId", 'Active', COALESCE(u."CreatedAt", now()), NULL
                FROM identity."AspNetUsers" u
                WHERE u."Id" NOT IN ({PlatformAdminAccountsSql});
                """);
        }

        private static void BindAccessAssignmentsToMemberships(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE identity."UserAccessProfiles" uap
                SET "TenantMembershipId" = m."Id"
                FROM identity."TenantMemberships" m
                WHERE m."UserId" = uap."UserId"
                  AND m."TenantId" = uap."TenantId";
                """);

            // Any assignment left unbound means the source data was contradictory in
            // a way the preflight did not anticipate. Abort rather than invent one.
            migrationBuilder.Sql("""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(format('account=%s tenant=%s profile=%s', "UserId", "TenantId", "AccessProfileId"), '; ')
                    INTO offenders
                    FROM identity."UserAccessProfiles"
                    WHERE "TenantMembershipId" IS NULL;

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Membership backfill aborted: access assignments could not be bound to any membership (%). Resolve the account tenancy before migrating.', offenders;
                    END IF;
                END $$;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "TenantMembershipId",
                schema: "identity",
                table: "UserAccessProfiles",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }

        private static void BackfillTenantSettingsAndEntitlements(MigrationBuilder migrationBuilder)
        {
            // A tenant that already has members has completed bootstrap by
            // definition; one with none is still awaiting its administrator.
            migrationBuilder.Sql("""
                UPDATE identity."Tenants" t
                SET "AdministratorActivationStatus" = 'Active'
                WHERE EXISTS (
                    SELECT 1
                    FROM identity."TenantMemberships" m
                    WHERE m."TenantId" = t."Id" AND m."Status" = 'Active');
                """);

            // Core HR is mandatory for every tenant and cannot be disabled.
            // Performance is granted to pre-existing tenants because they already
            // had unrestricted module access; withholding it would be a regression
            // rather than a migration.
            migrationBuilder.Sql("""
                INSERT INTO identity."TenantModuleEntitlements" ("Id", "TenantId", "Module", "CreatedAt")
                SELECT gen_random_uuid(), t."Id", m."Module", now()
                FROM identity."Tenants" t
                CROSS JOIN (VALUES ('CoreHR'), ('Performance')) AS m("Module")
                ON CONFLICT DO NOTHING;
                """);
        }

        /// <summary>
        /// Classifies every invitation by explicit purpose and removes the legacy
        /// bootstrap credential. The preflight has already proven that no live
        /// invitation is ambiguous, so only terminal bootstrap rows are reclassified
        /// here and no usable workforce credential can be destroyed.
        /// </summary>
        private static void MigrateInvitationsToPurposeBoundCredentials(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE identity."InviteTokens"
                SET "Purpose" = CASE
                    WHEN "Role" = 'OrgAdmin' AND "EmployeeId" IS NULL THEN 'OrganizationBootstrap'
                    ELSE 'WorkforceAccount'
                END;
                """);

            // Belt and braces: any unaccepted bootstrap invitation is invalidated so
            // no retired link can activate a tenant.
            migrationBuilder.Sql("""
                UPDATE identity."InviteTokens"
                SET "IsRevoked" = true,
                    "RevokedAt" = COALESCE("RevokedAt", now())
                WHERE "Purpose" = 'OrganizationBootstrap'
                  AND "AcceptedAt" IS NULL;
                """);

            // Drop the raw secret from every bootstrap invitation, accepted or not.
            migrationBuilder.Sql("""
                UPDATE identity."InviteTokens"
                SET "Token" = NULL
                WHERE "Purpose" = 'OrganizationBootstrap';
                """);
        }

        private static void ApplyNewConstraints(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_UserAccessProfiles_AccessProfileId_TenantId",
                schema: "identity",
                table: "UserAccessProfiles",
                columns: new[] { "AccessProfileId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_UserAccessProfiles_TenantMembershipId_AccessProfileId",
                schema: "identity",
                table: "UserAccessProfiles",
                columns: new[] { "TenantMembershipId", "AccessProfileId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserAccessProfiles_TenantMembershipId_UserId_TenantId",
                schema: "identity",
                table: "UserAccessProfiles",
                columns: new[] { "TenantMembershipId", "UserId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_AdministratorActivationStatus",
                schema: "identity",
                table: "Tenants",
                column: "AdministratorActivationStatus");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_CredentialSelector",
                schema: "identity",
                table: "InviteTokens",
                column: "CredentialSelector",
                unique: true,
                filter: "\"CredentialSelector\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_PredecessorInvitationId",
                schema: "identity",
                table: "InviteTokens",
                column: "PredecessorInvitationId");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId_BootstrapPending",
                schema: "identity",
                table: "InviteTokens",
                column: "TenantId",
                unique: true,
                filter: "\"Purpose\" = 'OrganizationBootstrap' AND \"AcceptedAt\" IS NULL AND \"IsRevoked\" = false AND \"SupersededAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId_Email_Pending",
                schema: "identity",
                table: "InviteTokens",
                columns: new[] { "TenantId", "Email" },
                unique: true,
                filter: "\"Purpose\" = 'WorkforceAccount' AND \"AcceptedAt\" IS NULL AND \"IsRevoked\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId_Purpose",
                schema: "identity",
                table: "InviteTokens",
                columns: new[] { "TenantId", "Purpose" });

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_Token",
                schema: "identity",
                table: "InviteTokens",
                column: "Token",
                unique: true,
                filter: "\"Token\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_InvitationActivationContinuations_HandleDigest",
                schema: "identity",
                table: "InvitationActivationContinuations",
                column: "HandleDigest",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InvitationActivationContinuations_InvitationId",
                schema: "identity",
                table: "InvitationActivationContinuations",
                column: "InvitationId");

            migrationBuilder.CreateIndex(
                name: "IX_InvitationDeliveryAttempts_InvitationId_AttemptedAt",
                schema: "identity",
                table: "InvitationDeliveryAttempts",
                columns: new[] { "InvitationId", "AttemptedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantBootstrapAuditEvents_CorrelationId",
                schema: "identity",
                table: "TenantBootstrapAuditEvents",
                column: "CorrelationId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantBootstrapAuditEvents_InvitationId",
                schema: "identity",
                table: "TenantBootstrapAuditEvents",
                column: "InvitationId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantBootstrapAuditEvents_TenantId_OccurredAt",
                schema: "identity",
                table: "TenantBootstrapAuditEvents",
                columns: new[] { "TenantId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantMemberships_TenantId",
                schema: "identity",
                table: "TenantMemberships",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantMemberships_UserId_ActiveUnique",
                schema: "identity",
                table: "TenantMemberships",
                column: "UserId",
                unique: true,
                filter: "\"Status\" = 'Active'");

            migrationBuilder.CreateIndex(
                name: "IX_TenantMemberships_UserId_TenantId",
                schema: "identity",
                table: "TenantMemberships",
                columns: new[] { "UserId", "TenantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantModuleEntitlements_TenantId_Module",
                schema: "identity",
                table: "TenantModuleEntitlements",
                columns: new[] { "TenantId", "Module" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantProvisioningReceipts_BootstrapInvitationId_TenantId",
                schema: "identity",
                table: "TenantProvisioningReceipts",
                columns: new[] { "BootstrapInvitationId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantProvisioningReceipts_TenantId",
                schema: "identity",
                table: "TenantProvisioningReceipts",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_InviteTokens_InviteTokens_PredecessorInvitationId",
                schema: "identity",
                table: "InviteTokens",
                column: "PredecessorInvitationId",
                principalSchema: "identity",
                principalTable: "InviteTokens",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Tenant-safe: an assignment cannot reference a profile owned by a
            // different tenant.
            migrationBuilder.AddForeignKey(
                name: "FK_UserAccessProfiles_AccessProfiles_AccessProfileId_TenantId",
                schema: "identity",
                table: "UserAccessProfiles",
                columns: new[] { "AccessProfileId", "TenantId" },
                principalSchema: "identity",
                principalTable: "AccessProfiles",
                principalColumns: new[] { "Id", "TenantId" },
                onDelete: ReferentialAction.Restrict);

            // Restrict, not Cascade: deleting an account must never silently erase
            // access history.
            migrationBuilder.AddForeignKey(
                name: "FK_UserAccessProfiles_AspNetUsers_UserId",
                schema: "identity",
                table: "UserAccessProfiles",
                column: "UserId",
                principalSchema: "identity",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserAccessProfiles_TenantMemberships_TenantMembershipId_Use~",
                schema: "identity",
                table: "UserAccessProfiles",
                columns: new[] { "TenantMembershipId", "UserId", "TenantId" },
                principalSchema: "identity",
                principalTable: "TenantMemberships",
                principalColumns: new[] { "Id", "UserId", "TenantId" },
                onDelete: ReferentialAction.Restrict);

            // Core HR is mandatory for every tenant. A unique index cannot express
            // "this row may never be removed, repointed, or changed", so the
            // invariant is held in the database by a trigger rather than left to
            // caller discipline.
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION identity.prevent_core_hr_entitlement_removal()
                RETURNS trigger AS $$
                BEGIN
                    IF (TG_OP = 'DELETE') THEN
                        IF OLD."Module" = 'CoreHR' THEN
                            RAISE EXCEPTION 'Core HR entitlement cannot be disabled for tenant %.', OLD."TenantId";
                        END IF;
                        RETURN OLD;
                    END IF;

                    IF OLD."Module" = 'CoreHR' THEN
                        IF NEW."Module" <> 'CoreHR' THEN
                            RAISE EXCEPTION 'Core HR entitlement cannot be disabled for tenant %.', OLD."TenantId";
                        END IF;

                        -- Repointing the row would strip the mandatory entitlement
                        -- from the tenant that currently holds it.
                        IF NEW."TenantId" <> OLD."TenantId" THEN
                            RAISE EXCEPTION 'Core HR entitlement cannot be moved away from tenant %.', OLD."TenantId";
                        END IF;
                    END IF;

                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                """);

            migrationBuilder.Sql("""
                CREATE TRIGGER trg_prevent_core_hr_entitlement_removal
                BEFORE DELETE OR UPDATE ON identity."TenantModuleEntitlements"
                FOR EACH ROW EXECUTE FUNCTION identity.prevent_core_hr_entitlement_removal();
                """);
        }

        /// <summary>
        /// Proves the migration converged. These assertions run inside the same
        /// transaction as the backfill, so a failure rolls the whole cutover back.
        /// </summary>
        private static void AssertBackfillConverged(MigrationBuilder migrationBuilder)
        {
            // Source and result counts must reconcile exactly.
            migrationBuilder.Sql($"""
                DO $$
                DECLARE expected bigint;
                DECLARE actual bigint;
                BEGIN
                    SELECT count(*) INTO expected
                    FROM identity."AspNetUsers" u
                    WHERE u."Id" NOT IN ({PlatformAdminAccountsSql});

                    SELECT count(*) INTO actual FROM identity."TenantMemberships";

                    IF expected <> actual THEN
                        RAISE EXCEPTION 'Membership backfill did not reconcile: % eligible accounts produced % memberships.', expected, actual;
                    END IF;
                END $$;
                """);

            // Platform Administrators must hold zero customer memberships.
            migrationBuilder.Sql($"""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(format('account=%s tenant=%s', m."UserId", m."TenantId"), '; ')
                    INTO offenders
                    FROM identity."TenantMemberships" m
                    WHERE m."UserId" IN ({PlatformAdminAccountsSql});

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Migration aborted: Platform Administrator accounts received customer memberships (%).', offenders;
                    END IF;
                END $$;
                """);

            // No bootstrap invitation may retain a raw credential.
            migrationBuilder.Sql("""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(format('invitation=%s', "Id"), '; ')
                    INTO offenders
                    FROM identity."InviteTokens"
                    WHERE "Purpose" = 'OrganizationBootstrap' AND "Token" IS NOT NULL;

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Migration aborted: bootstrap invitations still hold a raw credential (%).', offenders;
                    END IF;
                END $$;
                """);

            // Every tenant must hold the mandatory Core HR entitlement.
            migrationBuilder.Sql("""
                DO $$
                DECLARE offenders text;
                BEGIN
                    SELECT string_agg(format('tenant=%s', t."Id"), '; ')
                    INTO offenders
                    FROM identity."Tenants" t
                    WHERE NOT EXISTS (
                        SELECT 1 FROM identity."TenantModuleEntitlements" e
                        WHERE e."TenantId" = t."Id" AND e."Module" = 'CoreHR');

                    IF offenders IS NOT NULL THEN
                        RAISE EXCEPTION 'Migration aborted: tenants are missing the mandatory Core HR entitlement (%).', offenders;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS trg_prevent_core_hr_entitlement_removal
                ON identity."TenantModuleEntitlements";
                """);

            migrationBuilder.Sql("""
                DROP FUNCTION IF EXISTS identity.prevent_core_hr_entitlement_removal();
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_InviteTokens_InviteTokens_PredecessorInvitationId",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropForeignKey(
                name: "FK_UserAccessProfiles_AccessProfiles_AccessProfileId_TenantId",
                schema: "identity",
                table: "UserAccessProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_UserAccessProfiles_AspNetUsers_UserId",
                schema: "identity",
                table: "UserAccessProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_UserAccessProfiles_TenantMemberships_TenantMembershipId_Use~",
                schema: "identity",
                table: "UserAccessProfiles");

            migrationBuilder.DropTable(
                name: "InvitationActivationContinuations",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "InvitationDeliveryAttempts",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "TenantBootstrapAuditEvents",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "TenantProvisioningReceipts",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "TenantMemberships",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "TenantModuleEntitlements",
                schema: "identity");

            migrationBuilder.DropIndex(
                name: "IX_UserAccessProfiles_AccessProfileId_TenantId",
                schema: "identity",
                table: "UserAccessProfiles");

            migrationBuilder.DropIndex(
                name: "IX_UserAccessProfiles_TenantMembershipId_AccessProfileId",
                schema: "identity",
                table: "UserAccessProfiles");

            migrationBuilder.DropIndex(
                name: "IX_UserAccessProfiles_TenantMembershipId_UserId_TenantId",
                schema: "identity",
                table: "UserAccessProfiles");

            migrationBuilder.DropIndex(
                name: "IX_Tenants_AdministratorActivationStatus",
                schema: "identity",
                table: "Tenants");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_InviteTokens_Id_TenantId",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_AccessProfiles_Id_TenantId",
                schema: "identity",
                table: "AccessProfiles");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_CredentialSelector",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_PredecessorInvitationId",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_BootstrapPending",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_Email_Pending",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_Purpose",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_Token",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "TenantMembershipId",
                schema: "identity",
                table: "UserAccessProfiles");

            migrationBuilder.DropColumn(
                name: "AdministratorActivationStatus",
                schema: "identity",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "Locale",
                schema: "identity",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "TimeZone",
                schema: "identity",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "CredentialDigest",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "CredentialIssuedAt",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "CredentialSelector",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "PredecessorInvitationId",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "Purpose",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "ReplacedByInvitationId",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "SupersededAt",
                schema: "identity",
                table: "InviteTokens");

            // Rows whose bootstrap credential was removed cannot be restored; the
            // down path only restores the shape. Each row gets a distinct
            // non-activatable placeholder so the unique token index can be rebuilt,
            // and the rows stay revoked so no placeholder can be used to activate.
            migrationBuilder.Sql("""
                UPDATE identity."InviteTokens"
                SET "Token" = 'retired-' || replace(gen_random_uuid()::text, '-', '')
                WHERE "Token" IS NULL;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "Token",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId",
                schema: "identity",
                table: "InviteTokens",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId_Email_Pending",
                schema: "identity",
                table: "InviteTokens",
                columns: new[] { "TenantId", "Email" },
                unique: true,
                filter: "\"AcceptedAt\" IS NULL AND \"IsRevoked\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_Token",
                schema: "identity",
                table: "InviteTokens",
                column: "Token",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_UserAccessProfiles_AspNetUsers_UserId",
                schema: "identity",
                table: "UserAccessProfiles",
                column: "UserId",
                principalSchema: "identity",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserAccessProfiles_AccessProfiles_AccessProfileId",
                schema: "identity",
                table: "UserAccessProfiles",
                column: "AccessProfileId",
                principalSchema: "identity",
                principalTable: "AccessProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

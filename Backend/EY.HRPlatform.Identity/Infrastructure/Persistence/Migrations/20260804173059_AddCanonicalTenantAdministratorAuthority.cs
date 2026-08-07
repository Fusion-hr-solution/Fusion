using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCanonicalTenantAdministratorAuthority : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The retained non-active membership state becomes reversible
            // 'Suspended'. A repository search found no runtime path that produces
            // the old terminal 'Inactive' value, so a non-zero count here disproves
            // that finding and the migration must stop rather than silently
            // reinterpret a termination as a suspension.
            migrationBuilder.Sql("""
                DO $$
                DECLARE
                    stranded integer;
                    ids text;
                BEGIN
                    SELECT count(*), string_agg("Id"::text, ', ')
                      INTO stranded, ids
                      FROM identity."TenantMemberships"
                     WHERE "Status" = 'Inactive';

                    IF stranded > 0 THEN
                        RAISE EXCEPTION
                            'Migration stopped: % membership(s) still carry the removed Inactive state (%). '
                            'A runtime path produces it that the canonical authority design did not account for; '
                            'resolve the ownership of that path before converting the status vocabulary.',
                            stranded, ids;
                    END IF;
                END $$;
                """);

            migrationBuilder.RenameColumn(
                name: "DeactivatedAt",
                schema: "identity",
                table: "TenantMemberships",
                newName: "SuspendedAt");

            migrationBuilder.AddColumn<int>(
                name: "AccessRevision",
                schema: "identity",
                table: "TenantMemberships",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReactivatedAt",
                schema: "identity",
                table: "TenantMemberships",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReactivatedByUserId",
                schema: "identity",
                table: "TenantMemberships",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SuspendedByUserId",
                schema: "identity",
                table: "TenantMemberships",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SuspensionReason",
                schema: "identity",
                table: "TenantMemberships",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TenantAdministratorAssignments",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantMembershipId = table.Column<Guid>(type: "uuid", nullable: false),
                    GrantedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    GrantedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    GrantedByActorType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SourceInvitationId = table.Column<Guid>(type: "uuid", nullable: true),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RevokedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    RevocationReason = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantAdministratorAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantAdministratorAssignments_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "identity",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TenantAdministratorAssignments_TenantMemberships_TenantMemb~",
                        columns: x => new { x.TenantMembershipId, x.UserId, x.TenantId },
                        principalSchema: "identity",
                        principalTable: "TenantMemberships",
                        principalColumns: new[] { "Id", "UserId", "TenantId" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TenantMemberships_AuthorityState",
                schema: "identity",
                table: "TenantMemberships",
                columns: new[] { "UserId", "TenantId", "Status", "AccessRevision" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantAdministratorAssignments_MembershipActiveUnique",
                schema: "identity",
                table: "TenantAdministratorAssignments",
                column: "TenantMembershipId",
                unique: true,
                filter: "\"RevokedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_TenantAdministratorAssignments_SourceInvitationId",
                schema: "identity",
                table: "TenantAdministratorAssignments",
                column: "SourceInvitationId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantAdministratorAssignments_TenantId",
                schema: "identity",
                table: "TenantAdministratorAssignments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantAdministratorAssignments_TenantId_RevokedAt",
                schema: "identity",
                table: "TenantAdministratorAssignments",
                columns: new[] { "TenantId", "RevokedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantAdministratorAssignments_TenantMembershipId_UserId_Te~",
                schema: "identity",
                table: "TenantAdministratorAssignments",
                columns: new[] { "TenantMembershipId", "UserId", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantAdministratorAssignments_UserId",
                schema: "identity",
                table: "TenantAdministratorAssignments",
                column: "UserId");

            // Convert every pre-canonical administrator assignment into the
            // canonical authority record. The originating membership is preserved,
            // so no second account, membership, or authority is created.
            migrationBuilder.Sql("""
                INSERT INTO identity."TenantAdministratorAssignments"
                    ("Id", "TenantId", "UserId", "TenantMembershipId",
                     "GrantedAt", "GrantedByUserId", "GrantedByActorType", "SourceInvitationId",
                     "RevokedAt", "RevokedByUserId", "RevocationReason")
                SELECT
                    gen_random_uuid(),
                    assignment."TenantId",
                    assignment."UserId",
                    assignment."TenantMembershipId",
                    assignment."CreatedAt",
                    NULL,
                    'Migration',
                    NULL,
                    NULL,
                    NULL,
                    NULL
                  FROM identity."UserAccessProfiles" AS assignment
                  JOIN identity."AccessProfiles" AS profile
                    ON profile."Id" = assignment."AccessProfileId"
                 -- Profiles seeded before internal keys existed are identified by
                 -- the same legacy names the runtime seeder maps. The runtime
                 -- key-migration has not necessarily run yet when this executes,
                 -- so matching the key alone would miss real administrators and
                 -- then trip the continuity assertion below.
                 WHERE (profile."InternalKey" = 'org-admin'
                        OR (profile."InternalKey" IS NULL
                            AND lower(profile."Name") IN ('org admin', 'core admin',
                                                          'core administrator',
                                                          'organization administrator')))
                   AND NOT EXISTS (
                        SELECT 1
                          FROM identity."TenantAdministratorAssignments" AS existing
                         WHERE existing."TenantMembershipId" = assignment."TenantMembershipId"
                           AND existing."RevokedAt" IS NULL);
                """);

            // Fail-fast assertions with per-tenant diagnostics. Completing this
            // migration with an unadministered tenant is worse than not completing
            // it: the tenant would have no supported route back into its own
            // administration.
            migrationBuilder.Sql("""
                DO $$
                DECLARE
                    offending text;
                BEGIN
                    -- Source and result counts reconcile per tenant.
                    SELECT string_agg(
                               format('tenant %s: %s source assignment(s), %s canonical assignment(s)',
                                      reconciliation."TenantId", reconciliation.source_count, reconciliation.canonical_count),
                               '; ')
                      INTO offending
                      FROM (
                            SELECT source."TenantId",
                                   count(DISTINCT source."TenantMembershipId") AS source_count,
                                   (SELECT count(*)
                                      FROM identity."TenantAdministratorAssignments" AS canonical
                                     WHERE canonical."TenantId" = source."TenantId"
                                       AND canonical."RevokedAt" IS NULL) AS canonical_count
                              FROM identity."UserAccessProfiles" AS source
                              JOIN identity."AccessProfiles" AS profile
                                ON profile."Id" = source."AccessProfileId"
                             WHERE (profile."InternalKey" = 'org-admin'
                                    OR (profile."InternalKey" IS NULL
                                        AND lower(profile."Name") IN ('org admin', 'core admin',
                                                                      'core administrator',
                                                                      'organization administrator')))
                             GROUP BY source."TenantId"
                           ) AS reconciliation
                     WHERE reconciliation.source_count <> reconciliation.canonical_count;

                    IF offending IS NOT NULL THEN
                        RAISE EXCEPTION
                            'Migration stopped: canonical administrator backfill did not reconcile. %', offending;
                    END IF;

                    -- No tenant loses administration through this conversion.
                    --
                    -- Scoped to tenants that actually had a pre-canonical
                    -- administrator: those are the ones this migration is
                    -- responsible for carrying across. A tenant that already had
                    -- none was unadministered before this ran, and blocking the
                    -- whole deployment on pre-existing data would neither create
                    -- nor repair that administrator — so it is reported loudly
                    -- instead of being converted into a failed deployment.
                    SELECT string_agg(DISTINCT source."TenantId"::text, ', ')
                      INTO offending
                      FROM identity."UserAccessProfiles" AS source
                      JOIN identity."AccessProfiles" AS profile
                        ON profile."Id" = source."AccessProfileId"
                     WHERE (profile."InternalKey" = 'org-admin'
                            OR (profile."InternalKey" IS NULL
                                AND lower(profile."Name") IN ('org admin', 'core admin',
                                                              'core administrator',
                                                              'organization administrator')))
                       AND NOT EXISTS (SELECT 1
                                         FROM identity."TenantAdministratorAssignments" AS canonical
                                        WHERE canonical."TenantId" = source."TenantId"
                                          AND canonical."RevokedAt" IS NULL);

                    IF offending IS NOT NULL THEN
                        RAISE EXCEPTION
                            'Migration stopped: tenant(s) would lose their administrator in the conversion: %.', offending;
                    END IF;

                    SELECT string_agg(tenant."Id"::text || ' (' || tenant."Name" || ')', ', ')
                      INTO offending
                      FROM identity."Tenants" AS tenant
                     WHERE tenant."IsActive"
                       AND NOT tenant."IsArchived"
                       AND EXISTS (SELECT 1
                                     FROM identity."TenantMemberships" AS membership
                                    WHERE membership."TenantId" = tenant."Id"
                                      AND membership."Status" = 'Active')
                       AND NOT EXISTS (SELECT 1
                                         FROM identity."TenantAdministratorAssignments" AS canonical
                                        WHERE canonical."TenantId" = tenant."Id"
                                          AND canonical."RevokedAt" IS NULL);

                    IF offending IS NOT NULL THEN
                        RAISE WARNING
                            'Tenant(s) have active members but no Tenant Administrator and need Platform-assisted '
                            'recovery: %.', offending;
                    END IF;

                    -- Authority never crosses a tenant boundary. The composite
                    -- foreign key already makes this unstorable; the assertion
                    -- proves the backfill did not find a way around it.
                    SELECT string_agg(canonical."Id"::text, ', ')
                      INTO offending
                      FROM identity."TenantAdministratorAssignments" AS canonical
                      JOIN identity."TenantMemberships" AS membership
                        ON membership."Id" = canonical."TenantMembershipId"
                     WHERE membership."TenantId" <> canonical."TenantId"
                        OR membership."UserId" <> canonical."UserId";

                    IF offending IS NOT NULL THEN
                        RAISE EXCEPTION
                            'Migration stopped: assignment(s) disagree with their membership tenant or account: %.', offending;
                    END IF;
                END $$;
                """);

            // Append-only enforcement is applied and verified by
            // HardenAccessAuditAppendOnly. It is not done here because this
            // migration runs as the migrating principal, which is not the role the
            // service connects as — revoking from the wrong role would have looked
            // like enforcement without being any.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The matching grant belongs to HardenAccessAuditAppendOnly, which now
            // owns the privilege change.

            migrationBuilder.DropTable(
                name: "TenantAdministratorAssignments",
                schema: "identity");

            migrationBuilder.DropIndex(
                name: "IX_TenantMemberships_AuthorityState",
                schema: "identity",
                table: "TenantMemberships");

            migrationBuilder.DropColumn(
                name: "AccessRevision",
                schema: "identity",
                table: "TenantMemberships");

            migrationBuilder.DropColumn(
                name: "ReactivatedAt",
                schema: "identity",
                table: "TenantMemberships");

            migrationBuilder.DropColumn(
                name: "ReactivatedByUserId",
                schema: "identity",
                table: "TenantMemberships");

            migrationBuilder.DropColumn(
                name: "SuspendedByUserId",
                schema: "identity",
                table: "TenantMemberships");

            migrationBuilder.DropColumn(
                name: "SuspensionReason",
                schema: "identity",
                table: "TenantMemberships");

            migrationBuilder.RenameColumn(
                name: "SuspendedAt",
                schema: "identity",
                table: "TenantMemberships",
                newName: "DeactivatedAt");
        }
    }
}

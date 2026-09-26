using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReconcileWorkforceImportLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 0. Precondition: publication must not be in flight. Converting an attempt while the worker
            //    is writing canonical employees would be unsafe; let it finish, then run the migration.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM corehr."WorkforceImportApplyOperations" WHERE "Status" IN ('Queued', 'Running')) THEN
                        RAISE EXCEPTION 'A workforce import is being published. Let it finish, then apply this migration.';
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM corehr."WorkforceImportHistories" h
                        LEFT JOIN corehr."WorkforceImportSessions" s ON s."Id" = h."SessionId" AND s."Status" = 'Committed'
                        WHERE s."Id" IS NULL) THEN
                        RAISE EXCEPTION 'Workforce import history exists without its committed attempt; refusing to fold history.';
                    END IF;
                END $$;
                """);

            // 1. Standing semantic consent becomes shared across import domains. The data contract
            //    version already names the domain, so Organization consent never covers Workforce.
            migrationBuilder.RenameTable(name: "OrganizationImportSemanticConsents", schema: "corehr", newName: "ImportSemanticConsents", newSchema: "corehr");
            migrationBuilder.Sql("""ALTER TABLE corehr."ImportSemanticConsents" RENAME CONSTRAINT "PK_OrganizationImportSemanticConsents" TO "PK_ImportSemanticConsents";""");
            migrationBuilder.RenameIndex(name: "UX_OrganizationImportSemanticConsents_Tenant_Provider_Contract_Active", schema: "corehr",
                table: "ImportSemanticConsents", newName: "UX_ImportSemanticConsents_Tenant_Provider_Contract_Active");
            migrationBuilder.RenameIndex(name: "UX_OrganizationImportSemanticConsents_Session_Provider_Contract_Active", schema: "corehr",
                table: "ImportSemanticConsents", newName: "UX_ImportSemanticConsents_Session_Provider_Contract_Active");

            // 2. Attempt shape: Match plan and Review resolutions are separate documents; the counts name
            //    what publication will do; the proposal fingerprint replaces the review digests.
            migrationBuilder.RenameColumn(name: "DecisionsJson", schema: "corehr", table: "WorkforceImportSessions", newName: "ResolutionsJson");
            migrationBuilder.AddColumn<string>(name: "MappingPlanJson", schema: "corehr", table: "WorkforceImportSessions",
                type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb");
            migrationBuilder.RenameColumn(name: "NewCount", schema: "corehr", table: "WorkforceImportSessions", newName: "CreateCount");
            migrationBuilder.RenameColumn(name: "ExistingAnchorCount", schema: "corehr", table: "WorkforceImportSessions", newName: "ExistingCount");
            migrationBuilder.RenameColumn(name: "NeedsAttentionCount", schema: "corehr", table: "WorkforceImportSessions", newName: "BlockedCount");
            migrationBuilder.RenameColumn(name: "ExcludedCount", schema: "corehr", table: "WorkforceImportSessions", newName: "NotImportedCount");
            migrationBuilder.AddColumn<int>(name: "WarningCount", schema: "corehr", table: "WorkforceImportSessions", type: "integer", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<bool>(name: "MatchComplete", schema: "corehr", table: "WorkforceImportSessions", type: "boolean", nullable: false, defaultValue: false);
            migrationBuilder.RenameColumn(name: "ReviewDigest", schema: "corehr", table: "WorkforceImportSessions", newName: "ProposalFingerprint");
            migrationBuilder.RenameColumn(name: "FinalSemanticDigest", schema: "corehr", table: "WorkforceImportSessions", newName: "FinalProposalFingerprint");
            migrationBuilder.AddColumn<DateTime>(name: "PublishingStartedAt", schema: "corehr", table: "WorkforceImportSessions",
                type: "timestamp with time zone", nullable: true);

            migrationBuilder.RenameColumn(name: "IsExcluded", schema: "corehr", table: "WorkforceImportRows", newName: "HasWarning");
            migrationBuilder.AddColumn<string>(name: "SearchText", schema: "corehr", table: "WorkforceImportRows", type: "text", nullable: true);
            migrationBuilder.AddColumn<string>(name: "ReviewedProposalFingerprint", schema: "corehr", table: "WorkforceImportApplyOperations",
                type: "character varying(64)", maxLength: 64, nullable: false, defaultValue: "");

            // 3. Committed history folds into the committed attempt itself, as in Organization Import.
            //    Canonical employees, assignments, manager links and their ImportBatchId are untouched.
            migrationBuilder.Sql("""
                UPDATE corehr."WorkforceImportSessions" s
                SET "CommitResultJson" = COALESCE(s."CommitResultJson", jsonb_build_object(
                        'SessionId', h."SessionId", 'AlreadyApplied', false, 'AddedEmployeeCount', h."AddedEmployeeCount",
                        'ManagerRelationshipCount', 0, 'AddedEmployeeKeys', h."CreatedEmployeeKeysJson",
                        'ExistingCount', h."ExistingAnchorCount", 'NotImportedCount', h."ExcludedCount")),
                    "FinalProvenanceJson" = jsonb_build_object(
                        'sourceFileName', h."SourceFileName", 'sourceSha256', h."Sha256", 'baselineDate', h."BaselineDate",
                        'createdEmployeeKeys', h."CreatedEmployeeKeysJson")
                FROM corehr."WorkforceImportHistories" h
                WHERE h."SessionId" = s."Id" AND s."Status" = 'Committed';
                """);

            // 4. In-flight attempts: convert only when the conversion is faithful. Exclusion, keep-unchanged
            //    and per-row manager overrides no longer exist; an attempt that used them cannot be carried
            //    over without changing the proposal its administrator built, so it is discarded and purged
            //    once, as a migration technique. Everything else maps one to one.
            migrationBuilder.Sql("""
                CREATE TEMP TABLE wfi_unfaithful ON COMMIT DROP AS
                SELECT "Id" FROM corehr."WorkforceImportSessions"
                WHERE "Status" = 'Expired'
                   OR ("Status" IN ('Intake', 'Interpreting', 'Reviewing', 'Ready', 'Applying') AND (
                        jsonb_array_length(COALESCE("ResolutionsJson"->'excludedRows', '[]'::jsonb)) > 0
                     OR jsonb_array_length(COALESCE("ResolutionsJson"->'keepFusionUnchangedRows', '[]'::jsonb)) > 0
                     OR jsonb_array_length(COALESCE("ResolutionsJson"->'noManagerRows', '[]'::jsonb)) > 0
                     OR COALESCE("ResolutionsJson"->'managerEmployeeByRow', '{}'::jsonb) <> '{}'::jsonb));

                UPDATE corehr."WorkforceImportSessions" s
                SET "Status" = 'Discarded', "DiscardedAt" = COALESCE(s."DiscardedAt", now()), "PayloadPurgedAt" = COALESCE(s."PayloadPurgedAt", now()),
                    "MappingPlanJson" = '{}'::jsonb, "ResolutionsJson" = '{}'::jsonb, "ProposalFingerprint" = NULL
                WHERE s."Id" IN (SELECT "Id" FROM wfi_unfaithful);
                UPDATE corehr."WorkforceImportSources" SET "RawBytes" = NULL, "ColumnsJson" = NULL, "PayloadPurgedAt" = COALESCE("PayloadPurgedAt", now())
                WHERE "SessionId" IN (SELECT "Id" FROM wfi_unfaithful);
                UPDATE corehr."WorkforceImportRows" SET "SourceCellsJson" = NULL, "NormalizedProposalJson" = NULL, "IssueStateJson" = NULL,
                    "PayloadPurgedAt" = COALESCE("PayloadPurgedAt", now())
                WHERE "SessionId" IN (SELECT "Id" FROM wfi_unfaithful);

                UPDATE corehr."WorkforceImportSessions" s
                SET "Status" = 'Active',
                    "MappingPlanJson" = jsonb_strip_nulls(jsonb_build_object(
                        'columnMappings', COALESCE(d->'columnMappings', '{}'::jsonb),
                        'columnOrigins', COALESCE((SELECT jsonb_object_agg(k, to_jsonb('Administrator'::text)) FROM jsonb_object_keys(COALESCE(d->'columnMappings', '{}'::jsonb)) k), '{}'::jsonb),
                        'dateFormat', d->'dateFormat',
                        'nameFormat', d->'nameFormat',
                        'formatOrigin', CASE WHEN d ? 'dateFormat' OR d ? 'nameFormat' THEN to_jsonb('Administrator'::text) END)),
                    "ResolutionsJson" = jsonb_build_object(
                        'organizationBySourceValue', COALESCE(d->'organizationBySourceValue', '{}'::jsonb),
                        'managerEmployeeByReference', COALESCE(d->'managerEmployeeByReference', '{}'::jsonb),
                        'managerImportRowByReference', COALESCE(d->'managerImportRowByReference', '{}'::jsonb),
                        'noManagerByReference', COALESCE(d->'noManagerByReference', '[]'::jsonb),
                        'keepAsDistinctRows', COALESCE(d->'keepAsDistinctRows', '[]'::jsonb),
                        'useBaselineForWorkDates', COALESCE(d->'normalizeWorkDatesToBaseline', 'false'::jsonb)),
                    "CreateCount" = 0, "ExistingCount" = 0, "BlockedCount" = 0, "NotImportedCount" = 0,
                    "MatchComplete" = false, "ProposalFingerprint" = NULL
                FROM (SELECT "Id" AS id, "ResolutionsJson" AS d FROM corehr."WorkforceImportSessions") legacy
                WHERE legacy.id = s."Id" AND s."Status" IN ('Intake', 'Interpreting', 'Reviewing', 'Ready', 'Applying');

                -- Row classifications take the new names; rows of converted attempts are re-derived on first open.
                UPDATE corehr."WorkforceImportRows" r
                SET "Classification" = CASE
                        WHEN s."Status" = 'Active' THEN 'Unresolved'
                        WHEN r."Classification" = 'NewEmployee' THEN 'Create'
                        WHEN r."Classification" = 'ExistingAnchor' THEN 'Existing'
                        WHEN r."Classification" = 'NeedsAttention' THEN 'Blocked'
                        WHEN r."Classification" = 'Excluded' THEN 'NotImported'
                        ELSE r."Classification" END,
                    "HasWarning" = false
                FROM corehr."WorkforceImportSessions" s
                WHERE s."Id" = r."SessionId";
                """);

            // 5. Remove what the shared lifecycle no longer has: expiry, the single-active rule, the
            //    separate history table, and the unused digests.
            migrationBuilder.DropIndex(name: "IX_WorkforceImportSessions_Tenant_Status_ExpiresAt", schema: "corehr", table: "WorkforceImportSessions");
            migrationBuilder.DropIndex(name: "UX_WorkforceImportSessions_Tenant_ActiveSingleton", schema: "corehr", table: "WorkforceImportSessions");
            migrationBuilder.DropColumn(name: "ExpiresAt", schema: "corehr", table: "WorkforceImportSessions");
            migrationBuilder.DropColumn(name: "ExpiredAt", schema: "corehr", table: "WorkforceImportSessions");
            migrationBuilder.DropColumn(name: "AppliedStartedAt", schema: "corehr", table: "WorkforceImportSessions");
            migrationBuilder.DropColumn(name: "CanonicalObservationDigest", schema: "corehr", table: "WorkforceImportSessions");
            migrationBuilder.DropColumn(name: "DecisionRefsJson", schema: "corehr", table: "WorkforceImportRows");
            migrationBuilder.DropTable(name: "WorkforceImportHistories", schema: "corehr");

            // 6. Workforce semantic attempts, on the shared attempt contract.
            migrationBuilder.CreateTable(
                name: "WorkforceImportSemanticAttempts",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    AttemptOrdinal = table.Column<int>(type: "integer", nullable: false),
                    Trigger = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    SourceFingerprint = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    InputFingerprint = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DataContractVersion = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ResultContractVersion = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    PromptVersion = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Model = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    EligibleIssueKeysJson = table.Column<string>(type: "jsonb", nullable: false),
                    SuggestionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    ReusedFromAttemptId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProviderResponseId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    ProviderSystemFingerprint = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    FailureCategory = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: true),
                    DiagnosticCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RetryAfter = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RetryCount = table.Column<int>(type: "integer", nullable: false),
                    LatencyMilliseconds = table.Column<int>(type: "integer", nullable: true),
                    InputTokens = table.Column<int>(type: "integer", nullable: true),
                    OutputTokens = table.Column<int>(type: "integer", nullable: true),
                    QuestionsSubmitted = table.Column<int>(type: "integer", nullable: false),
                    SuggestionsReturned = table.Column<int>(type: "integer", nullable: false),
                    SuggestionsAccepted = table.Column<int>(type: "integer", nullable: false),
                    SuggestionsRejected = table.Column<int>(type: "integer", nullable: false),
                    SuggestionsApplied = table.Column<int>(type: "integer", nullable: false),
                    Abstentions = table.Column<int>(type: "integer", nullable: false),
                    SuggestionsOverridden = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkforceImportSemanticAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkforceImportSemanticAttempts_WorkforceImportSessions_Ses~",
                        column: x => x.SessionId,
                        principalSchema: "corehr",
                        principalTable: "WorkforceImportSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(name: "IX_WorkforceImportSemanticAttempts_SessionId", schema: "corehr",
                table: "WorkforceImportSemanticAttempts", column: "SessionId");
            migrationBuilder.CreateIndex(name: "IX_WorkforceImportSemanticAttempts_Tenant_Input_Status", schema: "corehr",
                table: "WorkforceImportSemanticAttempts", columns: new[] { "TenantId", "InputFingerprint", "Status" });
            migrationBuilder.CreateIndex(name: "IX_WorkforceImportSemanticAttempts_Tenant_Session_Status", schema: "corehr",
                table: "WorkforceImportSemanticAttempts", columns: new[] { "TenantId", "SessionId", "Status" });
            migrationBuilder.CreateIndex(name: "UX_WorkforceImportSemanticAttempts_Tenant_Session_Fingerprint_Ordinal", schema: "corehr",
                table: "WorkforceImportSemanticAttempts", columns: new[] { "TenantId", "SessionId", "InputFingerprint", "AttemptOrdinal" }, unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // One-way: legacy attempts were converted or purged and history was folded into the attempt.
            // Restoring the old lifecycle would invent state that no longer exists.
            throw new NotSupportedException("ReconcileWorkforceImportLifecycle cannot be reverted.");
        }
    }
}

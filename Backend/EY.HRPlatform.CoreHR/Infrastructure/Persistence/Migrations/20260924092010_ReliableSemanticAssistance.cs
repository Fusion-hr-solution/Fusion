using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReliableSemanticAssistance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SemanticConsentJson",
                schema: "corehr",
                table: "OrganizationImportSessions");

            migrationBuilder.DropColumn(
                name: "AppliedAt",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "AppliedByDisplayName",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "PayloadManifestDigest",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "ReviewOutcomesJson",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "Stage",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.RenameColumn(
                name: "ContractVersion",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                newName: "ResultContractVersion");

            migrationBuilder.DropColumn(
                name: "AppliedByUserId",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.AddColumn<Guid>(
                name: "ReusedFromAttemptId",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Abstentions",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "DataContractVersion",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PromptVersion",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ProviderResponseId",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProviderSystemFingerprint",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "QuestionsSubmitted",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "SourceFingerprint",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "SuggestionsAccepted",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SuggestionsApplied",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SuggestionsOverridden",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SuggestionsRejected",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SuggestionsReturned",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Trigger",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            // Legacy attempts join the new lifecycle: an interrupted Pending run failed, an Available
            // or Applied result succeeded, a Superseded one is stale. Their versions are marked
            // legacy so they are never reused as results under the current prompt and contract.
            migrationBuilder.Sql("""
                UPDATE corehr."OrganizationImportSemanticAttempts"
                SET "Status" = CASE "Status"
                        WHEN 'Pending' THEN 'Failed'
                        WHEN 'Available' THEN 'Succeeded'
                        WHEN 'Applied' THEN 'Succeeded'
                        WHEN 'Superseded' THEN 'Stale'
                        ELSE "Status" END,
                    "FailureCategory" = CASE WHEN "Status" = 'Pending' THEN 'Interrupted' ELSE "FailureCategory" END,
                    "Trigger" = 'Administrator',
                    "DataContractVersion" = 'legacy',
                    "PromptVersion" = 'legacy';
                """);

            migrationBuilder.CreateTable(
                name: "OrganizationImportSemanticConsents",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    DataContractVersion = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    GrantedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    GrantedByDisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    GrantedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationImportSemanticConsents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationImportSemanticAttempts_Tenant_Input_Status",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                columns: new[] { "TenantId", "InputFingerprint", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_OrganizationImportSemanticConsents_Tenant_Provider_Contract_Active",
                schema: "corehr",
                table: "OrganizationImportSemanticConsents",
                columns: new[] { "TenantId", "Provider", "DataContractVersion" },
                unique: true,
                filter: "\"RevokedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationImportSemanticConsents",
                schema: "corehr");

            migrationBuilder.DropIndex(
                name: "IX_OrganizationImportSemanticAttempts_Tenant_Input_Status",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "Abstentions",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "DataContractVersion",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "PromptVersion",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "ProviderResponseId",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "ProviderSystemFingerprint",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "QuestionsSubmitted",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "SourceFingerprint",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "SuggestionsAccepted",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "SuggestionsApplied",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "SuggestionsOverridden",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "SuggestionsRejected",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "SuggestionsReturned",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "Trigger",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.DropColumn(
                name: "ReusedFromAttemptId",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts");

            migrationBuilder.AddColumn<Guid>(
                name: "AppliedByUserId",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "uuid",
                nullable: true);

            migrationBuilder.RenameColumn(
                name: "ResultContractVersion",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                newName: "ContractVersion");

            migrationBuilder.AddColumn<string>(
                name: "SemanticConsentJson",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AppliedAt",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AppliedByDisplayName",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PayloadManifestDigest",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReviewOutcomesJson",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Stage",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");
        }
    }
}

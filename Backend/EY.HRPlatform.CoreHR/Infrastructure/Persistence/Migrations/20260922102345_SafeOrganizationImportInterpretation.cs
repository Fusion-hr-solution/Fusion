using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SafeOrganizationImportInterpretation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MappingConfirmationJson",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SemanticConsentJson",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DiagnosticCode",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Stage",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Legacy");

            migrationBuilder.AddColumn<string>(
                name: "PayloadManifestDigest",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "RetryCount",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "MappingConfirmationJson", schema: "corehr", table: "OrganizationImportSessions");
            migrationBuilder.DropColumn(name: "SemanticConsentJson", schema: "corehr", table: "OrganizationImportSessions");
            migrationBuilder.DropColumn(name: "DiagnosticCode", schema: "corehr", table: "OrganizationImportSemanticAttempts");
            migrationBuilder.DropColumn(name: "Stage", schema: "corehr", table: "OrganizationImportSemanticAttempts");
            migrationBuilder.DropColumn(name: "PayloadManifestDigest", schema: "corehr", table: "OrganizationImportSemanticAttempts");
            migrationBuilder.DropColumn(name: "RetryCount", schema: "corehr", table: "OrganizationImportSemanticAttempts");
        }
    }
}

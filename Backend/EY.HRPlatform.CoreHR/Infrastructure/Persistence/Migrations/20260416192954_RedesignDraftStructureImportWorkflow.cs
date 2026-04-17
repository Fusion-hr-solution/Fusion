using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RedesignDraftStructureImportWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_DraftOrgUnits_TenantId_Code",
                schema: "corehr",
                table: "DraftOrgUnits");

            migrationBuilder.DropIndex(
                name: "IX_DraftOrgUnits_TenantId_Name",
                schema: "corehr",
                table: "DraftOrgUnits");

            migrationBuilder.RenameColumn(
                name: "Code",
                schema: "corehr",
                table: "DraftOrgUnits",
                newName: "ReferenceKey");

            migrationBuilder.RenameColumn(
                name: "Type",
                schema: "corehr",
                table: "DraftOrgUnits",
                newName: "OrgUnitKindKey");

            migrationBuilder.RenameColumn(
                name: "Name",
                schema: "corehr",
                table: "DraftOrgUnits",
                newName: "DisplayName");

            migrationBuilder.AlterColumn<string>(
                name: "ReferenceKey",
                schema: "corehr",
                table: "DraftOrgUnits",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AddColumn<string>(
                name: "AttributesJson",
                schema: "corehr",
                table: "DraftOrgUnits",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BusinessCode",
                schema: "corehr",
                table: "DraftOrgUnits",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: "corehr",
                table: "DraftOrgUnits",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedReferenceKey",
                schema: "corehr",
                table: "DraftOrgUnits",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE corehr."DraftOrgUnits"
                SET "ReferenceKey" = COALESCE(NULLIF(BTRIM("ReferenceKey"), ''), "Id"::text),
                    "NormalizedReferenceKey" = UPPER(COALESCE(NULLIF(BTRIM("ReferenceKey"), ''), "Id"::text)),
                    "OrgUnitKindKey" = LOWER(COALESCE(NULLIF(BTRIM("OrgUnitKindKey"), ''), 'department')),
                    "BusinessCode" = COALESCE("BusinessCode", NULLIF(BTRIM("ReferenceKey"), ''));
                """);

            migrationBuilder.AlterColumn<string>(
                name: "NormalizedReferenceKey",
                schema: "corehr",
                table: "DraftOrgUnits",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(150)",
                oldMaxLength: 150,
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "DraftStructureImportSessions",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    Stage = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SourceFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    SourceFileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    SourceHeadersJson = table.Column<string>(type: "jsonb", nullable: false),
                    SourceRowsJson = table.Column<string>(type: "jsonb", nullable: false),
                    MappingJson = table.Column<string>(type: "jsonb", nullable: true),
                    KindReconciliationsJson = table.Column<string>(type: "jsonb", nullable: true),
                    NormalizedRowsJson = table.Column<string>(type: "jsonb", nullable: true),
                    ValidationIssuesJson = table.Column<string>(type: "jsonb", nullable: true),
                    SchemaFingerprint = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DraftWatermark = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DraftStructureImportSessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DraftOrgUnits_TenantId_NormalizedReferenceKey",
                schema: "corehr",
                table: "DraftOrgUnits",
                columns: new[] { "TenantId", "NormalizedReferenceKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DraftStructureImportSessions_ExpiresAt",
                schema: "corehr",
                table: "DraftStructureImportSessions",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_DraftStructureImportSessions_TenantId",
                schema: "corehr",
                table: "DraftStructureImportSessions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_DraftStructureImportSessions_TenantId_Stage",
                schema: "corehr",
                table: "DraftStructureImportSessions",
                columns: new[] { "TenantId", "Stage" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DraftStructureImportSessions",
                schema: "corehr");

            migrationBuilder.DropIndex(
                name: "IX_DraftOrgUnits_TenantId_NormalizedReferenceKey",
                schema: "corehr",
                table: "DraftOrgUnits");

            migrationBuilder.DropColumn(
                name: "AttributesJson",
                schema: "corehr",
                table: "DraftOrgUnits");

            migrationBuilder.DropColumn(
                name: "BusinessCode",
                schema: "corehr",
                table: "DraftOrgUnits");

            migrationBuilder.DropColumn(
                name: "Description",
                schema: "corehr",
                table: "DraftOrgUnits");

            migrationBuilder.DropColumn(
                name: "NormalizedReferenceKey",
                schema: "corehr",
                table: "DraftOrgUnits");

            migrationBuilder.RenameColumn(
                name: "OrgUnitKindKey",
                schema: "corehr",
                table: "DraftOrgUnits",
                newName: "Type");

            migrationBuilder.RenameColumn(
                name: "DisplayName",
                schema: "corehr",
                table: "DraftOrgUnits",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "ReferenceKey",
                schema: "corehr",
                table: "DraftOrgUnits",
                newName: "Code");

            migrationBuilder.AlterColumn<string>(
                name: "Code",
                schema: "corehr",
                table: "DraftOrgUnits",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(150)",
                oldMaxLength: 150);

            migrationBuilder.CreateIndex(
                name: "IX_DraftOrgUnits_TenantId_Code",
                schema: "corehr",
                table: "DraftOrgUnits",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DraftOrgUnits_TenantId_Name",
                schema: "corehr",
                table: "DraftOrgUnits",
                columns: new[] { "TenantId", "Name" },
                unique: true);
        }
    }
}

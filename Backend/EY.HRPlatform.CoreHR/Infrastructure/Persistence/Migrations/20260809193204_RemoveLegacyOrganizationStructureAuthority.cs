using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLegacyOrganizationStructureAuthority : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Development data is disposable. These former draft/publish tables are
            // intentionally removed instead of translated into invented history.
            migrationBuilder.DropTable(
                name: "DraftStructureImportSessions",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "DraftOrgUnits",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "TenantSetupActivities",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "TenantSetupStates",
                schema: "corehr");

            migrationBuilder.DropColumn(
                name: "ResponsibleManagerEmployeeId",
                schema: "corehr",
                table: "OrgUnits");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Keep the migration chain reversible for the repository's clean-slate
            // reset verification. These tables regain their pre-removal shape only
            // while rolling back to a legacy migration; the Up path remains the
            // authoritative removal of the retired draft/publish model.
            migrationBuilder.CreateTable(
                name: "TenantSetupStates",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CurrentPhase = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ActivatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StructurallyGovernedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StructurallyPublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OperationalAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedByFullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ApprovedByRole = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ApprovedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsApprovedInPlatformAssistMode = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    PublishedStructureVersion = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table => table.PrimaryKey("PK_TenantSetupStates", x => x.Id));

            migrationBuilder.CreateTable(
                name: "DraftOrgUnits",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReferenceKey = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OrgUnitKindKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    AttributesJson = table.Column<string>(type: "jsonb", nullable: true),
                    Location = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    NormalizedReferenceKey = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DraftOrgUnits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DraftOrgUnits_DraftOrgUnits_ParentId",
                        column: x => x.ParentId,
                        principalSchema: "corehr",
                        principalTable: "DraftOrgUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DraftStructureImportSessions",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
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
                constraints: table => table.PrimaryKey("PK_DraftStructureImportSessions", x => x.Id));

            migrationBuilder.CreateTable(
                name: "TenantSetupActivities",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantSetupStateId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActivityType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorFullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ActorRole = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    IsPlatformAssisted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantSetupActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantSetupActivities_TenantSetupStates_TenantSetupStateId",
                        column: x => x.TenantSetupStateId,
                        principalSchema: "corehr",
                        principalTable: "TenantSetupStates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(name: "IX_TenantSetupStates_TenantId", schema: "corehr", table: "TenantSetupStates", column: "TenantId", unique: true);
            migrationBuilder.CreateIndex(name: "IX_DraftOrgUnits_ParentId", schema: "corehr", table: "DraftOrgUnits", column: "ParentId");
            migrationBuilder.CreateIndex(name: "IX_DraftOrgUnits_TenantId", schema: "corehr", table: "DraftOrgUnits", column: "TenantId");
            migrationBuilder.CreateIndex(name: "IX_DraftOrgUnits_TenantId_NormalizedReferenceKey", schema: "corehr", table: "DraftOrgUnits", columns: new[] { "TenantId", "NormalizedReferenceKey" }, unique: true);
            migrationBuilder.CreateIndex(name: "IX_DraftStructureImportSessions_ExpiresAt", schema: "corehr", table: "DraftStructureImportSessions", column: "ExpiresAt");
            migrationBuilder.CreateIndex(name: "IX_DraftStructureImportSessions_TenantId", schema: "corehr", table: "DraftStructureImportSessions", column: "TenantId");
            migrationBuilder.CreateIndex(name: "IX_DraftStructureImportSessions_TenantId_Stage", schema: "corehr", table: "DraftStructureImportSessions", columns: new[] { "TenantId", "Stage" });
            migrationBuilder.CreateIndex(name: "IX_TenantSetupActivities_StateId_CreatedAt", schema: "corehr", table: "TenantSetupActivities", columns: new[] { "TenantSetupStateId", "CreatedAt" });
            migrationBuilder.CreateIndex(name: "IX_TenantSetupActivities_TenantId", schema: "corehr", table: "TenantSetupActivities", column: "TenantId");

            migrationBuilder.AddColumn<Guid>(
                name: "ResponsibleManagerEmployeeId",
                schema: "corehr",
                table: "OrgUnits",
                type: "uuid",
                nullable: true);
        }
    }
}

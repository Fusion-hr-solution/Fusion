using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationImportSourceIntake : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrganizationImportSessions",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CreationToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreationFingerprint = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    StartedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartedByDisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    LastUpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LastUpdatedByDisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    DiscardedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DiscardedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationImportSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationImportSources",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    OriginalFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    SourceFormat = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ByteLength = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SelectedSheetName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    SelectedRange = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ColumnCount = table.Column<int>(type: "integer", nullable: false),
                    RowCount = table.Column<int>(type: "integer", nullable: false),
                    SourceTableJson = table.Column<string>(type: "jsonb", nullable: true),
                    RawBytes = table.Column<byte[]>(type: "bytea", nullable: true),
                    PayloadPurgedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationImportSources", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationImportSources_OrganizationImportSessions_Sessio~",
                        column: x => x.SessionId,
                        principalSchema: "corehr",
                        principalTable: "OrganizationImportSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationImportSessions_Tenant_Status_UpdatedAt",
                schema: "corehr",
                table: "OrganizationImportSessions",
                columns: new[] { "TenantId", "Status", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "UX_OrganizationImportSessions_Tenant_CreationToken",
                schema: "corehr",
                table: "OrganizationImportSessions",
                columns: new[] { "TenantId", "CreationToken" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationImportSources_SessionId",
                schema: "corehr",
                table: "OrganizationImportSources",
                column: "SessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationImportSources_TenantId",
                schema: "corehr",
                table: "OrganizationImportSources",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationImportSources",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "OrganizationImportSessions",
                schema: "corehr");
        }
    }
}

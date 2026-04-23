using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeImportFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmployeeImportSessions",
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
                    PreviewRowsJson = table.Column<string>(type: "jsonb", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeImportSessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportSessions_ExpiresAt",
                schema: "corehr",
                table: "EmployeeImportSessions",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportSessions_TenantId",
                schema: "corehr",
                table: "EmployeeImportSessions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportSessions_TenantId_Stage",
                schema: "corehr",
                table: "EmployeeImportSessions",
                columns: new[] { "TenantId", "Stage" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeImportSessions",
                schema: "corehr");
        }
    }
}

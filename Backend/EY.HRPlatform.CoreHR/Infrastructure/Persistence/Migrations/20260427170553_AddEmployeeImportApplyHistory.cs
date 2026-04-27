using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeImportApplyHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AppliedAt",
                schema: "corehr",
                table: "EmployeeImportSessions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EmployeeImportHistories",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    SourceFileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    SourceRowCount = table.Column<int>(type: "integer", nullable: false),
                    ValidRowCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedCount = table.Column<int>(type: "integer", nullable: false),
                    SkippedCount = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorFullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ActorRole = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FailureReason = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeImportHistories", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportHistories_SessionId",
                schema: "corehr",
                table: "EmployeeImportHistories",
                column: "SessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportHistories_TenantId",
                schema: "corehr",
                table: "EmployeeImportHistories",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportHistories_TenantId_AppliedAt",
                schema: "corehr",
                table: "EmployeeImportHistories",
                columns: new[] { "TenantId", "AppliedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeImportHistories",
                schema: "corehr");

            migrationBuilder.DropColumn(
                name: "AppliedAt",
                schema: "corehr",
                table: "EmployeeImportSessions");
        }
    }
}

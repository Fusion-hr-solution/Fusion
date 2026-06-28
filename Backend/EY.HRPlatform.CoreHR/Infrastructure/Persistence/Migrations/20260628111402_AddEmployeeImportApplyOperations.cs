using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeImportApplyOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmployeeImportApplyOperations",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorFullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ActorRole = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    QueuedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FailedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LockedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    FailureReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    HistoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceRowCount = table.Column<int>(type: "integer", nullable: true),
                    ValidatedRowCount = table.Column<int>(type: "integer", nullable: true),
                    CreatedCount = table.Column<int>(type: "integer", nullable: true),
                    PublishedRowCount = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeImportApplyOperations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportApplyOperations_Status_LockedAt_CreatedAt",
                schema: "corehr",
                table: "EmployeeImportApplyOperations",
                columns: new[] { "Status", "LockedAt", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportApplyOperations_TenantId",
                schema: "corehr",
                table: "EmployeeImportApplyOperations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportApplyOperations_TenantId_SessionId_CreatedAt",
                schema: "corehr",
                table: "EmployeeImportApplyOperations",
                columns: new[] { "TenantId", "SessionId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeImportApplyOperations",
                schema: "corehr");
        }
    }
}

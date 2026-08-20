using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RetireLegacyEmployeeImport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeImportApplyOperations",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "EmployeeImportFollowUpIssues",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "EmployeeImportHistories",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "EmployeeImportSessions",
                schema: "corehr");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmployeeImportApplyOperations",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorFullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ActorRole = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CreatedCount = table.Column<int>(type: "integer", nullable: true),
                    FailedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FailureReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    HistoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    LockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LockedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ProcessedRowCount = table.Column<int>(type: "integer", nullable: false),
                    PublishedRowCount = table.Column<int>(type: "integer", nullable: true),
                    QueuedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceRowCount = table.Column<int>(type: "integer", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ValidatedRowCount = table.Column<int>(type: "integer", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeImportApplyOperations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EmployeeImportFollowUpIssues",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeImportHistoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    FieldKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    IssueCode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SourceRowNumber = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeImportFollowUpIssues", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EmployeeImportHistories",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorFullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ActorRole = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CreatedCount = table.Column<int>(type: "integer", nullable: false),
                    ErrorCount = table.Column<int>(type: "integer", nullable: false),
                    EventType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    FailureReason = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    PublishedRowCount = table.Column<int>(type: "integer", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    SourceFileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    SourceRowCount = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnchangedRowCount = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ValidatedRowCount = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    WarningCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeImportHistories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EmployeeImportSessions",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    BatchEffectiveDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ImportMode = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    NormalizedRowsJson = table.Column<string>(type: "jsonb", nullable: true),
                    PreviewRowsJson = table.Column<string>(type: "jsonb", nullable: false),
                    SourceFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    SourceFileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    SourceHeadersJson = table.Column<string>(type: "jsonb", nullable: false),
                    SourceRowsJson = table.Column<string>(type: "jsonb", nullable: false),
                    Stage = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ValidationIssuesJson = table.Column<string>(type: "jsonb", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeImportSessions", x => x.Id);
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

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportFollowUpIssues_HistoryId",
                schema: "corehr",
                table: "EmployeeImportFollowUpIssues",
                column: "EmployeeImportHistoryId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportFollowUpIssues_HistoryId_EmployeeId_Issue",
                schema: "corehr",
                table: "EmployeeImportFollowUpIssues",
                columns: new[] { "EmployeeImportHistoryId", "EmployeeId", "IssueCode", "FieldKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeImportFollowUpIssues_TenantId",
                schema: "corehr",
                table: "EmployeeImportFollowUpIssues",
                column: "TenantId");

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
    }
}

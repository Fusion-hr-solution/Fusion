using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeImportFollowUpIssues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmployeeImportFollowUpIssues",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    EmployeeImportHistoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceRowNumber = table.Column<int>(type: "integer", nullable: false),
                    IssueCode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FieldKey = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeImportFollowUpIssues", x => x.Id);
                });

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeImportFollowUpIssues",
                schema: "corehr");
        }
    }
}

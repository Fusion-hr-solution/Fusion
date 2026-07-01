using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExceptionCaseModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ExceptionCaseId",
                schema: "performance",
                table: "CampaignWorkItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ExceptionCases",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceWorkItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceWorkItemType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    SourceObjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    CurrentOwnerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FrozenReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    FailureCode = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FrozenWorkflowContextJson = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: false),
                    CurrentResolutionWorkItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    PreviousCaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolutionAction = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExceptionCases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExceptionCaseHistoryEntries",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExceptionCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FromOwnerEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ToOwnerEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    Action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ActorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Outcome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExceptionCaseHistoryEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExceptionCaseHistoryEntries_ExceptionCases_ExceptionCaseId",
                        column: x => x.ExceptionCaseId,
                        principalSchema: "performance",
                        principalTable: "ExceptionCases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignWorkItems_ExceptionCaseId",
                schema: "performance",
                table: "CampaignWorkItems",
                column: "ExceptionCaseId");

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionCaseHistoryEntries_ExceptionCaseId_OccurredAt",
                schema: "performance",
                table: "ExceptionCaseHistoryEntries",
                columns: new[] { "ExceptionCaseId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionCaseHistoryEntries_TenantId",
                schema: "performance",
                table: "ExceptionCaseHistoryEntries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionCases_CycleId_Status",
                schema: "performance",
                table: "ExceptionCases",
                columns: new[] { "CycleId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionCases_TenantId",
                schema: "performance",
                table: "ExceptionCases",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionCases_TenantId_SourceWorkItemId_SourceObjectId_Fai~",
                schema: "performance",
                table: "ExceptionCases",
                columns: new[] { "TenantId", "SourceWorkItemId", "SourceObjectId", "FailureCode", "Status" },
                unique: true,
                filter: "\"Status\" = 'Open'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExceptionCaseHistoryEntries",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ExceptionCases",
                schema: "performance");

            migrationBuilder.DropIndex(
                name: "IX_CampaignWorkItems_ExceptionCaseId",
                schema: "performance",
                table: "CampaignWorkItems");

            migrationBuilder.DropColumn(
                name: "ExceptionCaseId",
                schema: "performance",
                table: "CampaignWorkItems");
        }
    }
}

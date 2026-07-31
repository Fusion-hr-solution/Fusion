using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddObjectiveProgressUpdates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ObjectiveProgressUpdates",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgressPercent = table.Column<int>(type: "integer", nullable: false),
                    PreviousPercent = table.Column<int>(type: "integer", nullable: true),
                    ActualValue = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Comment = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsRegression = table.Column<bool>(type: "boolean", nullable: false),
                    RegressionReason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveProgressUpdates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ObjectiveProgressUpdates_EmployeeObjectivePlans_PlanId",
                        column: x => x.PlanId,
                        principalSchema: "performance",
                        principalTable: "EmployeeObjectivePlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveProgressUpdates_Objective_RecordedAt",
                schema: "performance",
                table: "ObjectiveProgressUpdates",
                columns: new[] { "ObjectiveId", "RecordedAt", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveProgressUpdates_PlanId",
                schema: "performance",
                table: "ObjectiveProgressUpdates",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveProgressUpdates_Tenant_Cycle",
                schema: "performance",
                table: "ObjectiveProgressUpdates",
                columns: new[] { "TenantId", "CycleId" });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveProgressUpdates_Tenant_Plan",
                schema: "performance",
                table: "ObjectiveProgressUpdates",
                columns: new[] { "TenantId", "PlanId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ObjectiveProgressUpdates",
                schema: "performance");
        }
    }
}

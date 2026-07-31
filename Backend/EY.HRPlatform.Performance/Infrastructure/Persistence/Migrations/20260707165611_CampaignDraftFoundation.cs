using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CampaignDraftFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EmployeeSubmissionDeadline",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpectedPlanningLockDate",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ManagerApprovalDeadline",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OwnerName",
                schema: "performance",
                table: "PerformanceCycles",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerUserId",
                schema: "performance",
                table: "PerformanceCycles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PlanningOpeningDate",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlanningRulesAllowedWeightMenu",
                schema: "performance",
                table: "PerformanceCycles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PlanningRulesCapturedAt",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlanningRulesEnabledMeasurementMethods",
                schema: "performance",
                table: "PerformanceCycles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PlanningRulesMaxObjectiveCount",
                schema: "performance",
                table: "PerformanceCycles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PlanningRulesSourceConfigurationVersionId",
                schema: "performance",
                table: "PerformanceCycles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Purpose",
                schema: "performance",
                table: "PerformanceCycles",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReferenceYear",
                schema: "performance",
                table: "PerformanceCycles",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CampaignStrategicObjectives",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ResponsibleFunctionLabel = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignStrategicObjectives", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CampaignStrategicObjectives_PerformanceCycles_CycleId",
                        column: x => x.CycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCycles_TenantId_ReferenceYear",
                schema: "performance",
                table: "PerformanceCycles",
                columns: new[] { "TenantId", "ReferenceYear" });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignStrategicObjectives_CycleId",
                schema: "performance",
                table: "CampaignStrategicObjectives",
                column: "CycleId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignStrategicObjectives_Tenant_Campaign",
                schema: "performance",
                table: "CampaignStrategicObjectives",
                columns: new[] { "TenantId", "CycleId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CampaignStrategicObjectives",
                schema: "performance");

            migrationBuilder.DropIndex(
                name: "IX_PerformanceCycles_TenantId_ReferenceYear",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "EmployeeSubmissionDeadline",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "ExpectedPlanningLockDate",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "ManagerApprovalDeadline",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "OwnerName",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "OwnerUserId",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "PlanningOpeningDate",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "PlanningRulesAllowedWeightMenu",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "PlanningRulesCapturedAt",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "PlanningRulesEnabledMeasurementMethods",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "PlanningRulesMaxObjectiveCount",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "PlanningRulesSourceConfigurationVersionId",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "Purpose",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "ReferenceYear",
                schema: "performance",
                table: "PerformanceCycles");
        }
    }
}

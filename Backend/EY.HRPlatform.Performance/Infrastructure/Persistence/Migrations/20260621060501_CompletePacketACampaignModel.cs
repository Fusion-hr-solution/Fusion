using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CompletePacketACampaignModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AssignmentPreparationStartedAt",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReadyToLaunchAt",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Level",
                schema: "performance",
                table: "ObjectiveTemplates",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Individual");

            migrationBuilder.AddColumn<Guid>(
                name: "ParentTemplateId",
                schema: "performance",
                table: "ObjectiveTemplates",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SuccessMeasure",
                schema: "performance",
                table: "ObjectiveTemplates",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Target",
                schema: "performance",
                table: "ObjectiveTemplates",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CampaignAssignmentResponsibilities",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssigneeEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssigneeName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Duty = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Source = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    RelationshipSource = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    OverrideReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsFinal = table.Column<bool>(type: "boolean", nullable: false),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignAssignmentResponsibilities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceObjectives",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OwnerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentObjectiveId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SuccessMeasure = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Target = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Weight = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceObjectives", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplates_Tenant_Parent",
                schema: "performance",
                table: "ObjectiveTemplates",
                columns: new[] { "TenantId", "ParentTemplateId" });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignAssignmentResponsibilities_CycleId_AssigneeEmployee~",
                schema: "performance",
                table: "CampaignAssignmentResponsibilities",
                columns: new[] { "CycleId", "AssigneeEmployeeId", "IsFinal" });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignAssignmentResponsibilities_CycleId_SubjectEmployeeI~",
                schema: "performance",
                table: "CampaignAssignmentResponsibilities",
                columns: new[] { "CycleId", "SubjectEmployeeId", "Duty", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CampaignAssignmentResponsibilities_TenantId",
                schema: "performance",
                table: "CampaignAssignmentResponsibilities",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceObjectives_CycleId_ParentObjectiveId",
                schema: "performance",
                table: "PerformanceObjectives",
                columns: new[] { "CycleId", "ParentObjectiveId" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceObjectives_TenantId_CycleId_OwnerEmployeeId",
                schema: "performance",
                table: "PerformanceObjectives",
                columns: new[] { "TenantId", "CycleId", "OwnerEmployeeId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CampaignAssignmentResponsibilities",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceObjectives",
                schema: "performance");

            migrationBuilder.DropIndex(
                name: "IX_ObjectiveTemplates_Tenant_Parent",
                schema: "performance",
                table: "ObjectiveTemplates");

            migrationBuilder.DropColumn(
                name: "AssignmentPreparationStartedAt",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "ReadyToLaunchAt",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "Level",
                schema: "performance",
                table: "ObjectiveTemplates");

            migrationBuilder.DropColumn(
                name: "ParentTemplateId",
                schema: "performance",
                table: "ObjectiveTemplates");

            migrationBuilder.DropColumn(
                name: "SuccessMeasure",
                schema: "performance",
                table: "ObjectiveTemplates");

            migrationBuilder.DropColumn(
                name: "Target",
                schema: "performance",
                table: "ObjectiveTemplates");
        }
    }
}

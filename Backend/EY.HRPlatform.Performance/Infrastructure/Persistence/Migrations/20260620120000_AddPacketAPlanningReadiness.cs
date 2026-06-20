using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations;

public partial class AddPacketAPlanningReadiness : Migration
{
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

        migrationBuilder.Sql("""
            UPDATE performance."PerformanceCycles"
            SET "Status" = 'AssignmentPreparation',
                "AssignmentPreparationStartedAt" = COALESCE("AssignmentPreparationStartedAt", "PublishedAt")
            WHERE "Status" = 'Published';
            """);

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
                Duty = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                Source = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                RelationshipSource = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                OverrideReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                IsFinal = table.Column<bool>(type: "boolean", nullable: false),
                Revision = table.Column<int>(type: "integer", nullable: false),
                RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                CreatedBy = table.Column<string>(type: "text", nullable: true),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                UpdatedBy = table.Column<string>(type: "text", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_CampaignAssignmentResponsibilities", x => x.Id));

        migrationBuilder.CreateIndex(
            name: "IX_CampaignAssignmentResponsibilities_Cycle_Subject_Duty_Revision",
            schema: "performance",
            table: "CampaignAssignmentResponsibilities",
            columns: new[] { "CycleId", "SubjectEmployeeId", "Duty", "Revision" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_CampaignAssignmentResponsibilities_Cycle_Assignee_IsFinal",
            schema: "performance",
            table: "CampaignAssignmentResponsibilities",
            columns: new[] { "CycleId", "AssigneeEmployeeId", "IsFinal" });

        migrationBuilder.CreateIndex(
            name: "IX_CampaignAssignmentResponsibilities_TenantId",
            schema: "performance",
            table: "CampaignAssignmentResponsibilities",
            column: "TenantId");

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

        migrationBuilder.AddColumn<Guid>(
            name: "PlanningApproverEmployeeId",
            schema: "performance",
            table: "PerformanceCycleParticipants",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "PlanningApproverName",
            schema: "performance",
            table: "PerformanceCycleParticipants",
            type: "character varying(256)",
            maxLength: 256,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "PlanningApproverOverrideReason",
            schema: "performance",
            table: "PerformanceCycleParticipants",
            type: "character varying(1000)",
            maxLength: 1000,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "PlanningApproverSource",
            schema: "performance",
            table: "PerformanceCycleParticipants",
            type: "character varying(30)",
            maxLength: 30,
            nullable: false,
            defaultValue: "Unresolved");

        migrationBuilder.CreateIndex(
            name: "IX_ObjectiveTemplates_Tenant_Parent",
            schema: "performance",
            table: "ObjectiveTemplates",
            columns: new[] { "TenantId", "ParentTemplateId" });

        migrationBuilder.CreateIndex(
            name: "IX_PerformanceCycleParticipants_Cycle_Approver",
            schema: "performance",
            table: "PerformanceCycleParticipants",
            columns: new[] { "CycleId", "PlanningApproverEmployeeId" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("CampaignAssignmentResponsibilities", "performance");
        migrationBuilder.DropColumn("AssignmentPreparationStartedAt", "performance", "PerformanceCycles");
        migrationBuilder.DropColumn("ReadyToLaunchAt", "performance", "PerformanceCycles");
        migrationBuilder.DropIndex("IX_ObjectiveTemplates_Tenant_Parent", "performance", "ObjectiveTemplates");
        migrationBuilder.DropIndex("IX_PerformanceCycleParticipants_Cycle_Approver", "performance", "PerformanceCycleParticipants");
        migrationBuilder.DropColumn("Level", "performance", "ObjectiveTemplates");
        migrationBuilder.DropColumn("ParentTemplateId", "performance", "ObjectiveTemplates");
        migrationBuilder.DropColumn("SuccessMeasure", "performance", "ObjectiveTemplates");
        migrationBuilder.DropColumn("Target", "performance", "ObjectiveTemplates");
        migrationBuilder.DropColumn("PlanningApproverEmployeeId", "performance", "PerformanceCycleParticipants");
        migrationBuilder.DropColumn("PlanningApproverName", "performance", "PerformanceCycleParticipants");
        migrationBuilder.DropColumn("PlanningApproverOverrideReason", "performance", "PerformanceCycleParticipants");
        migrationBuilder.DropColumn("PlanningApproverSource", "performance", "PerformanceCycleParticipants");
    }
}

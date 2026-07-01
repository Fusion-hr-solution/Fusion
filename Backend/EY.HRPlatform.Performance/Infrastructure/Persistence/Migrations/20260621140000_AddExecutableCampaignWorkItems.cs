using System;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PerformanceDbContext))]
[Migration("20260621140000_AddExecutableCampaignWorkItems")]
public partial class AddExecutableCampaignWorkItems : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "CampaignWorkItems",
            schema: "performance",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                AssigneeEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                DueAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                SourceAssignmentRevisionId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                CreatedBy = table.Column<string>(type: "text", nullable: true),
                UpdatedBy = table.Column<string>(type: "text", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_CampaignWorkItems", x => x.Id));

        migrationBuilder.CreateTable(
            name: "PerformanceObjectiveMilestones",
            schema: "performance",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                CreatedBy = table.Column<string>(type: "text", nullable: true),
                UpdatedBy = table.Column<string>(type: "text", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_PerformanceObjectiveMilestones", x => x.Id));

        migrationBuilder.CreateIndex(
            name: "IX_CampaignWorkItems_CycleId_SubjectEmployeeId_Type",
            schema: "performance",
            table: "CampaignWorkItems",
            columns: new[] { "CycleId", "SubjectEmployeeId", "Type" });
        migrationBuilder.CreateIndex(
            name: "IX_CampaignWorkItems_SourceAssignmentRevisionId",
            schema: "performance",
            table: "CampaignWorkItems",
            column: "SourceAssignmentRevisionId",
            unique: true);
        migrationBuilder.CreateIndex(
            name: "IX_CampaignWorkItems_TenantId_AssigneeEmployeeId_Status_DueAt",
            schema: "performance",
            table: "CampaignWorkItems",
            columns: new[] { "TenantId", "AssigneeEmployeeId", "Status", "DueAt" });
        migrationBuilder.CreateIndex(
            name: "IX_PerformanceObjectiveMilestones_TenantId_ObjectiveId_DueDate",
            schema: "performance",
            table: "PerformanceObjectiveMilestones",
            columns: new[] { "TenantId", "ObjectiveId", "DueDate" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "CampaignWorkItems", schema: "performance");
        migrationBuilder.DropTable(name: "PerformanceObjectiveMilestones", schema: "performance");
    }
}

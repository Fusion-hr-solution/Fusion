using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddObjectiveStatusChangeRequestsAndDevelopment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Status",
                schema: "performance",
                table: "ProgressUpdates",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentStatus",
                schema: "performance",
                table: "Objectives",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StatusAcknowledgedAt",
                schema: "performance",
                table: "Objectives",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StatusAcknowledgedByEmployeeId",
                schema: "performance",
                table: "Objectives",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StatusReportedAt",
                schema: "performance",
                table: "Objectives",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StatusSince",
                schema: "performance",
                table: "Objectives",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DevelopmentPlans",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CarryOverDismissedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DevelopmentPlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlanChangeRequests",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DecisionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveTitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Text = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Reply = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    AddressedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanChangeRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanChangeRequests_PlanDecisions_DecisionId",
                        column: x => x.DecisionId,
                        principalSchema: "performance",
                        principalTable: "PlanDecisions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProgressMilestoneChanges",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgressUpdateId = table.Column<Guid>(type: "uuid", nullable: false),
                    MilestoneId = table.Column<Guid>(type: "uuid", nullable: false),
                    Completed = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgressMilestoneChanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgressMilestoneChanges_ProgressUpdates_ProgressUpdateId",
                        column: x => x.ProgressUpdateId,
                        principalSchema: "performance",
                        principalTable: "ProgressUpdates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DevelopmentGoals",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DevelopmentPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CompetencyId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    TargetDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedByEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedByEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CarriedFromGoalId = table.Column<Guid>(type: "uuid", nullable: true),
                    CarriedToCycleId = table.Column<Guid>(type: "uuid", nullable: true),
                    CarriedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DevelopmentGoals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DevelopmentGoals_DevelopmentPlans_DevelopmentPlanId",
                        column: x => x.DevelopmentPlanId,
                        principalSchema: "performance",
                        principalTable: "DevelopmentPlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // A check-in now carries its milestone changes as a list. Each earlier milestone event becomes a
            // check-in with one change, then the single-milestone column goes.
            migrationBuilder.Sql("""
                INSERT INTO performance."ProgressMilestoneChanges" ("Id", "ProgressUpdateId", "MilestoneId", "Completed", "CreatedAt", "TenantId")
                SELECT gen_random_uuid(), u."Id", u."MilestoneId", u."Kind" = 'MilestoneCompleted', u."RecordedAt", u."TenantId"
                FROM performance."ProgressUpdates" u
                WHERE u."MilestoneId" IS NOT NULL;
                UPDATE performance."ProgressUpdates" SET "Kind" = 'MilestonesChanged'
                WHERE "Kind" IN ('MilestoneCompleted', 'MilestoneReopened');
                """);

            migrationBuilder.DropColumn(
                name: "MilestoneId",
                schema: "performance",
                table: "ProgressUpdates");

            migrationBuilder.CreateIndex(
                name: "IX_DevelopmentGoals_DevelopmentPlanId",
                schema: "performance",
                table: "DevelopmentGoals",
                column: "DevelopmentPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_DevelopmentPlans_TenantId",
                schema: "performance",
                table: "DevelopmentPlans",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_DevelopmentPlans_TenantId_CycleId_ParticipantId",
                schema: "performance",
                table: "DevelopmentPlans",
                columns: new[] { "TenantId", "CycleId", "ParticipantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DevelopmentPlans_TenantId_EmployeeId",
                schema: "performance",
                table: "DevelopmentPlans",
                columns: new[] { "TenantId", "EmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_PlanChangeRequests_DecisionId",
                schema: "performance",
                table: "PlanChangeRequests",
                column: "DecisionId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgressMilestoneChanges_MilestoneId",
                schema: "performance",
                table: "ProgressMilestoneChanges",
                column: "MilestoneId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgressMilestoneChanges_ProgressUpdateId",
                schema: "performance",
                table: "ProgressMilestoneChanges",
                column: "ProgressUpdateId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "MilestoneId",
                schema: "performance",
                table: "ProgressUpdates",
                type: "uuid",
                nullable: true);

            // The single-milestone shape keeps a check-in's first change only, and has no status-only
            // check-ins: those are removed rather than left unreadable.
            migrationBuilder.Sql("""
                UPDATE performance."ProgressUpdates" u
                SET "MilestoneId" = c."MilestoneId",
                    "Kind" = CASE WHEN c."Completed" THEN 'MilestoneCompleted' ELSE 'MilestoneReopened' END
                FROM (
                    SELECT DISTINCT ON ("ProgressUpdateId") "ProgressUpdateId", "MilestoneId", "Completed"
                    FROM performance."ProgressMilestoneChanges"
                    ORDER BY "ProgressUpdateId", "CreatedAt", "Id"
                ) c
                WHERE c."ProgressUpdateId" = u."Id";
                DELETE FROM performance."ProgressUpdates" WHERE "Kind" = 'StatusOnly';
                """);

            migrationBuilder.DropTable(
                name: "DevelopmentGoals",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PlanChangeRequests",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ProgressMilestoneChanges",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "DevelopmentPlans",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "Status",
                schema: "performance",
                table: "ProgressUpdates");

            migrationBuilder.DropColumn(
                name: "CurrentStatus",
                schema: "performance",
                table: "Objectives");

            migrationBuilder.DropColumn(
                name: "StatusAcknowledgedAt",
                schema: "performance",
                table: "Objectives");

            migrationBuilder.DropColumn(
                name: "StatusAcknowledgedByEmployeeId",
                schema: "performance",
                table: "Objectives");

            migrationBuilder.DropColumn(
                name: "StatusReportedAt",
                schema: "performance",
                table: "Objectives");

            migrationBuilder.DropColumn(
                name: "StatusSince",
                schema: "performance",
                table: "Objectives");

        }
    }
}

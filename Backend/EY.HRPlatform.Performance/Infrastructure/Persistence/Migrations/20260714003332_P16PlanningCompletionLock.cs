using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class P16PlanningCompletionLock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PlanningLockedAt",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlanningLockedByName",
                schema: "performance",
                table: "PerformanceCycles",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PlanningLockedByUserId",
                schema: "performance",
                table: "PerformanceCycles",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PerformanceCycleApproverReassignments",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PreviousApproverEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    PreviousApproverName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NewApproverEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    NewApproverName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ReassignedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReassignedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ReassignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceCycleApproverReassignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformanceCycleApproverReassignments_PerformanceCycleParti~",
                        columns: x => new { x.CycleId, x.ParticipantEmployeeId },
                        principalSchema: "performance",
                        principalTable: "PerformanceCycleParticipants",
                        principalColumns: new[] { "CycleId", "EmployeeId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PerformanceCycleApproverReassignments_PerformanceCycles_Cyc~",
                        column: x => x.CycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceCycleParticipantExclusions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ExcludedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ExcludedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ExcludedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceCycleParticipantExclusions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformanceCycleParticipantExclusions_PerformanceCycleParti~",
                        columns: x => new { x.CycleId, x.ParticipantEmployeeId },
                        principalSchema: "performance",
                        principalTable: "PerformanceCycleParticipants",
                        principalColumns: new[] { "CycleId", "EmployeeId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PerformanceCycleParticipantExclusions_PerformanceCycles_Cyc~",
                        column: x => x.CycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PerformancePlanningReminders",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    TargetType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    RecordedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    RecordedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NotificationTriggered = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformancePlanningReminders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformancePlanningReminders_PerformanceCycles_CycleId",
                        column: x => x.CycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApproverReassignments_Tenant_Cycle_NewApprover",
                schema: "performance",
                table: "PerformanceCycleApproverReassignments",
                columns: new[] { "TenantId", "CycleId", "NewApproverEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_ApproverReassignments_Tenant_Cycle_Participant_Time",
                schema: "performance",
                table: "PerformanceCycleApproverReassignments",
                columns: new[] { "TenantId", "CycleId", "ParticipantEmployeeId", "ReassignedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCycleApproverReassignments_CycleId_ParticipantEm~",
                schema: "performance",
                table: "PerformanceCycleApproverReassignments",
                columns: new[] { "CycleId", "ParticipantEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantExclusions_Tenant_Cycle",
                schema: "performance",
                table: "PerformanceCycleParticipantExclusions",
                columns: new[] { "TenantId", "CycleId" });

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantExclusions_Tenant_Cycle_Participant",
                schema: "performance",
                table: "PerformanceCycleParticipantExclusions",
                columns: new[] { "TenantId", "CycleId", "ParticipantEmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCycleParticipantExclusions_CycleId_ParticipantEm~",
                schema: "performance",
                table: "PerformanceCycleParticipantExclusions",
                columns: new[] { "CycleId", "ParticipantEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformancePlanningReminders_CycleId",
                schema: "performance",
                table: "PerformancePlanningReminders",
                column: "CycleId");

            migrationBuilder.CreateIndex(
                name: "IX_PlanningReminders_Tenant_Cycle_Participant_Time",
                schema: "performance",
                table: "PerformancePlanningReminders",
                columns: new[] { "TenantId", "CycleId", "ParticipantEmployeeId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PlanningReminders_Tenant_Cycle_Target_Time",
                schema: "performance",
                table: "PerformancePlanningReminders",
                columns: new[] { "TenantId", "CycleId", "TargetEmployeeId", "RecordedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PerformanceCycleApproverReassignments",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceCycleParticipantExclusions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformancePlanningReminders",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "PlanningLockedAt",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "PlanningLockedByName",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "PlanningLockedByUserId",
                schema: "performance",
                table: "PerformanceCycles");
        }
    }
}

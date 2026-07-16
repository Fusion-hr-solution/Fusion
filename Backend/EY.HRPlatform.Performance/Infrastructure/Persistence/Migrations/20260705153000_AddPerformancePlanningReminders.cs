using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PerformanceDbContext))]
[Migration("20260705153000_AddPerformancePlanningReminders")]
public partial class AddPerformancePlanningReminders : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
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

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "PerformancePlanningReminders",
            schema: "performance");
    }
}

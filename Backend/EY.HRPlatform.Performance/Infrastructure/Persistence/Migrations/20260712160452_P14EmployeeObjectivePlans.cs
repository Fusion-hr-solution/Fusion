using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class P14EmployeeObjectivePlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "AK_PerformanceCycleParticipants_CycleId_EmployeeId",
                schema: "performance",
                table: "PerformanceCycleParticipants",
                columns: new[] { "CycleId", "EmployeeId" });

            migrationBuilder.CreateTable(
                name: "EmployeeObjectivePlans",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Draft"),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApproverEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApproverName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeObjectivePlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmployeeObjectivePlans_PerformanceCycleParticipants_CycleId~",
                        columns: x => new { x.CycleId, x.EmployeeId },
                        principalSchema: "performance",
                        principalTable: "PerformanceCycleParticipants",
                        principalColumns: new[] { "CycleId", "EmployeeId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmployeeObjectivePlans_PerformanceCycles_CycleId",
                        column: x => x.CycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EmployeeObjectives",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    AlignmentType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    AlignmentTargetId = table.Column<Guid>(type: "uuid", nullable: true),
                    AlignmentTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Weight = table.Column<int>(type: "integer", nullable: true),
                    Deadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MeasurementMethod = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    MeasurementIndicator = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TargetValue = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    TargetUnit = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    SuccessCriteria = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeObjectives", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmployeeObjectives_EmployeeObjectivePlans_PlanId",
                        column: x => x.PlanId,
                        principalSchema: "performance",
                        principalTable: "EmployeeObjectivePlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeObjectivePlans_CycleId_EmployeeId",
                schema: "performance",
                table: "EmployeeObjectivePlans",
                columns: new[] { "CycleId", "EmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeObjectivePlans_Tenant_Campaign",
                schema: "performance",
                table: "EmployeeObjectivePlans",
                columns: new[] { "TenantId", "CycleId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeObjectivePlans_Tenant_Campaign_Employee",
                schema: "performance",
                table: "EmployeeObjectivePlans",
                columns: new[] { "TenantId", "CycleId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeObjectivePlans_Tenant_Employee",
                schema: "performance",
                table: "EmployeeObjectivePlans",
                columns: new[] { "TenantId", "EmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeObjectives_Alignment",
                schema: "performance",
                table: "EmployeeObjectives",
                columns: new[] { "AlignmentType", "AlignmentTargetId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeObjectives_Plan",
                schema: "performance",
                table: "EmployeeObjectives",
                column: "PlanId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeObjectives",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EmployeeObjectivePlans",
                schema: "performance");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_PerformanceCycleParticipants_CycleId_EmployeeId",
                schema: "performance",
                table: "PerformanceCycleParticipants");
        }
    }
}

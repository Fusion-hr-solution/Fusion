using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeePlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EmployeePlanId",
                schema: "performance",
                table: "Objectives",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PlanWeight",
                schema: "performance",
                table: "Objectives",
                type: "numeric(6,2)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EmployeePlans",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeDisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    OrgUnitName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ResponsibleManagerId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResponsibleManagerName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovalKind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ApprovedByEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeePlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlanDecisions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ActorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Feedback = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanDecisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanDecisions_EmployeePlans_PlanId",
                        column: x => x.PlanId,
                        principalSchema: "performance",
                        principalTable: "EmployeePlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Objectives_EmployeePlanId",
                schema: "performance",
                table: "Objectives",
                column: "EmployeePlanId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeePlans_CycleId",
                schema: "performance",
                table: "EmployeePlans",
                column: "CycleId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeePlans_ResponsibleManagerId",
                schema: "performance",
                table: "EmployeePlans",
                column: "ResponsibleManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeePlans_TenantId",
                schema: "performance",
                table: "EmployeePlans",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeePlans_TenantId_CycleId_EmployeeId",
                schema: "performance",
                table: "EmployeePlans",
                columns: new[] { "TenantId", "CycleId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeePlans_TenantId_CycleId_ParticipantId",
                schema: "performance",
                table: "EmployeePlans",
                columns: new[] { "TenantId", "CycleId", "ParticipantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlanDecisions_PlanId",
                schema: "performance",
                table: "PlanDecisions",
                column: "PlanId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlanDecisions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EmployeePlans",
                schema: "performance");

            migrationBuilder.DropIndex(
                name: "IX_Objectives_EmployeePlanId",
                schema: "performance",
                table: "Objectives");

            migrationBuilder.DropColumn(
                name: "EmployeePlanId",
                schema: "performance",
                table: "Objectives");

            migrationBuilder.DropColumn(
                name: "PlanWeight",
                schema: "performance",
                table: "Objectives");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUpdateRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UpdateRequests",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetKey = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedByEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedByName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SatisfiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SatisfiedByProgressUpdateId = table.Column<Guid>(type: "uuid", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UpdateRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UpdateRequests_EmployeePlans_PlanId",
                        column: x => x.PlanId,
                        principalSchema: "performance",
                        principalTable: "EmployeePlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UpdateRequests_PlanId",
                schema: "performance",
                table: "UpdateRequests",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_UpdateRequests_TenantId",
                schema: "performance",
                table: "UpdateRequests",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_UpdateRequests_TenantId_CycleId_PlanId",
                schema: "performance",
                table: "UpdateRequests",
                columns: new[] { "TenantId", "CycleId", "PlanId" });

            migrationBuilder.CreateIndex(
                name: "IX_UpdateRequests_TenantId_EmployeeId_State",
                schema: "performance",
                table: "UpdateRequests",
                columns: new[] { "TenantId", "EmployeeId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_UpdateRequests_TenantId_TargetKey",
                schema: "performance",
                table: "UpdateRequests",
                columns: new[] { "TenantId", "TargetKey" },
                unique: true,
                filter: "\"State\" = 'Open'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UpdateRequests",
                schema: "performance");
        }
    }
}

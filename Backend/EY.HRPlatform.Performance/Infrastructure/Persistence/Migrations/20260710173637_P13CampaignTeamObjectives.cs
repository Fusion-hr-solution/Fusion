using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class P13CampaignTeamObjectives : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CampaignTeamObjectives",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    StrategicObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerManagerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerManagerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SuccessCriteria = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    MeasurementMethod = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignTeamObjectives", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CampaignTeamObjectives_CampaignStrategicObjectives_Strategi~",
                        column: x => x.StrategicObjectiveId,
                        principalSchema: "performance",
                        principalTable: "CampaignStrategicObjectives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CampaignTeamObjectives_PerformanceCycles_CycleId",
                        column: x => x.CycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignTeamObjectives_CycleId",
                schema: "performance",
                table: "CampaignTeamObjectives",
                column: "CycleId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignTeamObjectives_StrategicObjectiveId",
                schema: "performance",
                table: "CampaignTeamObjectives",
                column: "StrategicObjectiveId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignTeamObjectives_Tenant_Campaign",
                schema: "performance",
                table: "CampaignTeamObjectives",
                columns: new[] { "TenantId", "CycleId" });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignTeamObjectives_Tenant_Campaign_Owner",
                schema: "performance",
                table: "CampaignTeamObjectives",
                columns: new[] { "TenantId", "CycleId", "OwnerManagerEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignTeamObjectives_Tenant_StrategicObjective",
                schema: "performance",
                table: "CampaignTeamObjectives",
                columns: new[] { "TenantId", "StrategicObjectiveId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CampaignTeamObjectives",
                schema: "performance");
        }
    }
}

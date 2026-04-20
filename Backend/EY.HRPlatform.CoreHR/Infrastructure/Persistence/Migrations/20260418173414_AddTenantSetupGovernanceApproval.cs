using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantSetupGovernanceApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                schema: "corehr",
                table: "TenantSetupStates",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedByFullName",
                schema: "corehr",
                table: "TenantSetupStates",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedByRole",
                schema: "corehr",
                table: "TenantSetupStates",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedByUserId",
                schema: "corehr",
                table: "TenantSetupStates",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsApprovedInPlatformAssistMode",
                schema: "corehr",
                table: "TenantSetupStates",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "TenantSetupActivities",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantSetupStateId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActivityType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorFullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ActorRole = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    IsPlatformAssisted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantSetupActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantSetupActivities_TenantSetupStates_TenantSetupStateId",
                        column: x => x.TenantSetupStateId,
                        principalSchema: "corehr",
                        principalTable: "TenantSetupStates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TenantSetupActivities_StateId_CreatedAt",
                schema: "corehr",
                table: "TenantSetupActivities",
                columns: new[] { "TenantSetupStateId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantSetupActivities_TenantId",
                schema: "corehr",
                table: "TenantSetupActivities",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TenantSetupActivities",
                schema: "corehr");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                schema: "corehr",
                table: "TenantSetupStates");

            migrationBuilder.DropColumn(
                name: "ApprovedByFullName",
                schema: "corehr",
                table: "TenantSetupStates");

            migrationBuilder.DropColumn(
                name: "ApprovedByRole",
                schema: "corehr",
                table: "TenantSetupStates");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                schema: "corehr",
                table: "TenantSetupStates");

            migrationBuilder.DropColumn(
                name: "IsApprovedInPlatformAssistMode",
                schema: "corehr",
                table: "TenantSetupStates");
        }
    }
}

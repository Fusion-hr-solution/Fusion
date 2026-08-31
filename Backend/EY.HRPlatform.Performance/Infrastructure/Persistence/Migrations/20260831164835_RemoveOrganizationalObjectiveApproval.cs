using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveOrganizationalObjectiveApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Organizational objectives no longer have a routine approval workflow: the lifecycle is
            // Draft → Published. Map any pre-existing rows onto the new states so they still load.
            migrationBuilder.Sql(
                "UPDATE performance.\"Objectives\" SET \"State\" = 'Published' WHERE \"State\" = 'Approved';");
            migrationBuilder.Sql(
                "UPDATE performance.\"Objectives\" SET \"State\" = 'Draft' WHERE \"State\" = 'Submitted';");

            migrationBuilder.DropTable(
                name: "ObjectiveDecisions",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                schema: "performance",
                table: "Objectives");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                schema: "performance",
                table: "Objectives",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ObjectiveDecisions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Feedback = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveDecisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ObjectiveDecisions_Objectives_ObjectiveId",
                        column: x => x.ObjectiveId,
                        principalSchema: "performance",
                        principalTable: "Objectives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveDecisions_ObjectiveId",
                schema: "performance",
                table: "ObjectiveDecisions",
                column: "ObjectiveId");
        }
    }
}

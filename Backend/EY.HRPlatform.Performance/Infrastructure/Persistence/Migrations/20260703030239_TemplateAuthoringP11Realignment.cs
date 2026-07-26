using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TemplateAuthoringP11Realignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExpectedOutcome",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Indicator",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Code",
                schema: "performance",
                table: "ObjectiveTemplateContainers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: "performance",
                table: "ObjectiveTemplateCategories",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            // Backfill system-generated stable codes for pre-existing templates before the
            // unique index is created (P1.1 §13.2: codes are system-generated, never user input).
            migrationBuilder.Sql(
                """
                UPDATE performance."ObjectiveTemplateContainers"
                SET "Code" = 'TPL-' || UPPER(SUBSTRING(REPLACE("Id"::text, '-', ''), 1, 8))
                WHERE "Code" = '';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateContainers_TenantId_Code",
                schema: "performance",
                table: "ObjectiveTemplateContainers",
                columns: new[] { "TenantId", "Code" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ObjectiveTemplateContainers_TenantId_Code",
                schema: "performance",
                table: "ObjectiveTemplateContainers");

            migrationBuilder.DropColumn(
                name: "ExpectedOutcome",
                schema: "performance",
                table: "ObjectiveTemplateRevisions");

            migrationBuilder.DropColumn(
                name: "Indicator",
                schema: "performance",
                table: "ObjectiveTemplateRevisions");

            migrationBuilder.DropColumn(
                name: "Code",
                schema: "performance",
                table: "ObjectiveTemplateContainers");

            migrationBuilder.DropColumn(
                name: "Description",
                schema: "performance",
                table: "ObjectiveTemplateCategories");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    public partial class AddApplicabilityToTemplateRevisions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApplicableOrgUnitIds",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                type: "text",
                nullable: false,
                defaultValueSql: "'[]'");

            migrationBuilder.AddColumn<string>(
                name: "ApplicableJobTitles",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                type: "text",
                nullable: false,
                defaultValueSql: "'[]'");

            migrationBuilder.AddColumn<string>(
                name: "ApplicableWorkLocations",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                type: "text",
                nullable: false,
                defaultValueSql: "'[]'");

            migrationBuilder.AddColumn<string>(
                name: "ApplicableEmploymentTypes",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                type: "text",
                nullable: false,
                defaultValueSql: "'[]'");

            migrationBuilder.AddColumn<string>(
                name: "ApplicabilityValidationState",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "NotValidated");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApplicableOrgUnitIds",
                schema: "performance",
                table: "ObjectiveTemplateRevisions");

            migrationBuilder.DropColumn(
                name: "ApplicableJobTitles",
                schema: "performance",
                table: "ObjectiveTemplateRevisions");

            migrationBuilder.DropColumn(
                name: "ApplicableWorkLocations",
                schema: "performance",
                table: "ObjectiveTemplateRevisions");

            migrationBuilder.DropColumn(
                name: "ApplicableEmploymentTypes",
                schema: "performance",
                table: "ObjectiveTemplateRevisions");

            migrationBuilder.DropColumn(
                name: "ApplicabilityValidationState",
                schema: "performance",
                table: "ObjectiveTemplateRevisions");
        }
    }
}

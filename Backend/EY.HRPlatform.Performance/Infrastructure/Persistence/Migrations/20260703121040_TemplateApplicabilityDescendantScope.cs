using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TemplateApplicabilityDescendantScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApplicableOrgUnitAndDescendantIds",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                type: "text",
                nullable: false,
                defaultValueSql: "'[]'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApplicableOrgUnitAndDescendantIds",
                schema: "performance",
                table: "ObjectiveTemplateRevisions");
        }
    }
}

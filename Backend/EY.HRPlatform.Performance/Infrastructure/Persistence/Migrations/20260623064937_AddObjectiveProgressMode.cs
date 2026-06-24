using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddObjectiveProgressMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ManualProgressPercent",
                schema: "performance",
                table: "PerformanceObjectives",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProgressMode",
                schema: "performance",
                table: "PerformanceObjectives",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ManualProgressPercent",
                schema: "performance",
                table: "PerformanceObjectives");

            migrationBuilder.DropColumn(
                name: "ProgressMode",
                schema: "performance",
                table: "PerformanceObjectives");
        }
    }
}

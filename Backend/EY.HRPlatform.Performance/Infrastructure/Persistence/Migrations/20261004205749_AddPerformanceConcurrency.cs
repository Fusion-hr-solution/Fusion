using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceConcurrency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "performance",
                table: "ProgressUpdates",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "performance",
                table: "PopulationDefinitions",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "performance",
                table: "PerformanceCycles",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "performance",
                table: "Objectives",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "performance",
                table: "EmployeePlans",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                schema: "performance",
                table: "CycleSettings",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "performance",
                table: "ProgressUpdates");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "performance",
                table: "PopulationDefinitions");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "performance",
                table: "Objectives");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "performance",
                table: "EmployeePlans");

            migrationBuilder.DropColumn(
                name: "xmin",
                schema: "performance",
                table: "CycleSettings");
        }
    }
}

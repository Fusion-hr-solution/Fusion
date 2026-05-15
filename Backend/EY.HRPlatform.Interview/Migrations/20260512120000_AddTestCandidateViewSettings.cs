using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    /// <inheritdoc />
    public partial class AddTestCandidateViewSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowBacktracking",
                table: "Tests",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AllowSkipping",
                table: "Tests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RandomizeOrder",
                table: "Tests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowProgressBar",
                table: "Tests",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowBacktracking",
                table: "Tests");

            migrationBuilder.DropColumn(
                name: "AllowSkipping",
                table: "Tests");

            migrationBuilder.DropColumn(
                name: "RandomizeOrder",
                table: "Tests");

            migrationBuilder.DropColumn(
                name: "ShowProgressBar",
                table: "Tests");
        }
    }
}

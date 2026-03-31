using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddChapterContentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EstimatedDurationMinutes",
                schema: "training",
                table: "Chapters",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TextContent",
                schema: "training",
                table: "Chapters",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VideoUrl",
                schema: "training",
                table: "Chapters",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EstimatedDurationMinutes",
                schema: "training",
                table: "Chapters");

            migrationBuilder.DropColumn(
                name: "TextContent",
                schema: "training",
                table: "Chapters");

            migrationBuilder.DropColumn(
                name: "VideoUrl",
                schema: "training",
                table: "Chapters");
        }
    }
}

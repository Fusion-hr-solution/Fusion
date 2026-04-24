using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class MakeGradeLevelUnique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Grades_Level",
                schema: "training",
                table: "Grades");

            migrationBuilder.CreateIndex(
                name: "IX_Grades_Level",
                schema: "training",
                table: "Grades",
                column: "Level",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Grades_Level",
                schema: "training",
                table: "Grades");

            migrationBuilder.CreateIndex(
                name: "IX_Grades_Level",
                schema: "training",
                table: "Grades",
                column: "Level");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddExamOrderIndexUniqueConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ExamQuestions_ExamId_OrderIndex",
                schema: "training",
                table: "ExamQuestions");

            migrationBuilder.DropIndex(
                name: "IX_ExamOptions_QuestionId_OrderIndex",
                schema: "training",
                table: "ExamOptions");

            migrationBuilder.CreateIndex(
                name: "IX_ExamQuestions_ExamId_OrderIndex",
                schema: "training",
                table: "ExamQuestions",
                columns: new[] { "ExamId", "OrderIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExamOptions_QuestionId_OrderIndex",
                schema: "training",
                table: "ExamOptions",
                columns: new[] { "QuestionId", "OrderIndex" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ExamQuestions_ExamId_OrderIndex",
                schema: "training",
                table: "ExamQuestions");

            migrationBuilder.DropIndex(
                name: "IX_ExamOptions_QuestionId_OrderIndex",
                schema: "training",
                table: "ExamOptions");

            migrationBuilder.CreateIndex(
                name: "IX_ExamQuestions_ExamId_OrderIndex",
                schema: "training",
                table: "ExamQuestions",
                columns: new[] { "ExamId", "OrderIndex" });

            migrationBuilder.CreateIndex(
                name: "IX_ExamOptions_QuestionId_OrderIndex",
                schema: "training",
                table: "ExamOptions",
                columns: new[] { "QuestionId", "OrderIndex" });
        }
    }
}

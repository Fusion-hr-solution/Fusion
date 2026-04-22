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

            // Fix any duplicate OrderIndex values that exist due to the previous default of 0.
            // Assign sequential 0-based order within each exam / question partition.
            migrationBuilder.Sql(@"
                UPDATE training.""ExamQuestions"" AS eq
                SET ""OrderIndex"" = sub.rn - 1
                FROM (
                    SELECT ""Id"", ROW_NUMBER() OVER (PARTITION BY ""ExamId"" ORDER BY ""Id"") AS rn
                    FROM training.""ExamQuestions""
                ) AS sub
                WHERE eq.""Id"" = sub.""Id"";
            ");

            migrationBuilder.Sql(@"
                UPDATE training.""ExamOptions"" AS eo
                SET ""OrderIndex"" = sub.rn - 1
                FROM (
                    SELECT ""Id"", ROW_NUMBER() OVER (PARTITION BY ""QuestionId"" ORDER BY ""Id"") AS rn
                    FROM training.""ExamOptions""
                ) AS sub
                WHERE eo.""Id"" = sub.""Id"";
            ");

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

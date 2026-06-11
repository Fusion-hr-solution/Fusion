using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueGradeResultPerQuestion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_QuestionGradeResults_AttemptId",
                table: "QuestionGradeResults");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Tests",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldDefaultValue: "Draft");

            // Remove any pre-existing duplicate results (leftovers from grading passes
            // that ran before idempotency was enforced) so the unique index can be
            // created. Keep the most recent row per (AttemptId, QuestionId).
            migrationBuilder.Sql(@"
                DELETE FROM ""QuestionGradeResults"" a
                USING (
                    SELECT ""Id"", ROW_NUMBER() OVER (
                        PARTITION BY ""AttemptId"", ""QuestionId""
                        ORDER BY ""CreatedAt"" DESC, ""Id"" DESC
                    ) AS rn
                    FROM ""QuestionGradeResults""
                ) d
                WHERE a.""Id"" = d.""Id"" AND d.rn > 1;");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionGradeResults_AttemptId_QuestionId",
                table: "QuestionGradeResults",
                columns: new[] { "AttemptId", "QuestionId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_QuestionGradeResults_AttemptId_QuestionId",
                table: "QuestionGradeResults");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Tests",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Draft",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.CreateIndex(
                name: "IX_QuestionGradeResults_AttemptId",
                table: "QuestionGradeResults",
                column: "AttemptId");
        }
    }
}

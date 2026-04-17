using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddExamQuizSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Exams_TrainingId",
                schema: "training",
                table: "Exams");

            migrationBuilder.DropIndex(
                name: "IX_ExamQuestions_ExamId",
                schema: "training",
                table: "ExamQuestions");

            migrationBuilder.DropIndex(
                name: "IX_ExamOptions_QuestionId",
                schema: "training",
                table: "ExamOptions");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                schema: "training",
                table: "Exams",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DurationMinutes",
                schema: "training",
                table: "Exams",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Type",
                schema: "training",
                table: "ExamQuestions",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AddColumn<int>(
                name: "OrderIndex",
                schema: "training",
                table: "ExamQuestions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Points",
                schema: "training",
                table: "ExamQuestions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "OrderIndex",
                schema: "training",
                table: "ExamOptions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CorrectAnswers",
                schema: "training",
                table: "ExamAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TotalQuestions",
                schema: "training",
                table: "ExamAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "TrainingId",
                schema: "training",
                table: "ExamAttempts",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_Exams_TrainingId",
                schema: "training",
                table: "Exams",
                column: "TrainingId",
                unique: true);

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Exams_TrainingId",
                schema: "training",
                table: "Exams");

            migrationBuilder.DropIndex(
                name: "IX_ExamQuestions_ExamId_OrderIndex",
                schema: "training",
                table: "ExamQuestions");

            migrationBuilder.DropIndex(
                name: "IX_ExamOptions_QuestionId_OrderIndex",
                schema: "training",
                table: "ExamOptions");

            migrationBuilder.DropColumn(
                name: "Description",
                schema: "training",
                table: "Exams");

            migrationBuilder.DropColumn(
                name: "DurationMinutes",
                schema: "training",
                table: "Exams");

            migrationBuilder.DropColumn(
                name: "OrderIndex",
                schema: "training",
                table: "ExamQuestions");

            migrationBuilder.DropColumn(
                name: "Points",
                schema: "training",
                table: "ExamQuestions");

            migrationBuilder.DropColumn(
                name: "OrderIndex",
                schema: "training",
                table: "ExamOptions");

            migrationBuilder.DropColumn(
                name: "CorrectAnswers",
                schema: "training",
                table: "ExamAttempts");

            migrationBuilder.DropColumn(
                name: "TotalQuestions",
                schema: "training",
                table: "ExamAttempts");

            migrationBuilder.DropColumn(
                name: "TrainingId",
                schema: "training",
                table: "ExamAttempts");

            migrationBuilder.AlterColumn<string>(
                name: "Type",
                schema: "training",
                table: "ExamQuestions",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(30)",
                oldMaxLength: 30);

            migrationBuilder.CreateIndex(
                name: "IX_Exams_TrainingId",
                schema: "training",
                table: "Exams",
                column: "TrainingId");

            migrationBuilder.CreateIndex(
                name: "IX_ExamQuestions_ExamId",
                schema: "training",
                table: "ExamQuestions",
                column: "ExamId");

            migrationBuilder.CreateIndex(
                name: "IX_ExamOptions_QuestionId",
                schema: "training",
                table: "ExamOptions",
                column: "QuestionId");
        }
    }
}

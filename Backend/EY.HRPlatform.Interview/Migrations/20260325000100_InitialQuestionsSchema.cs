using System;
using EY.HRPlatform.Interview.Infrastructure;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260325000100_InitialQuestionsSchema")]
    public partial class InitialQuestionsSchema : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Questions",
                columns: table => new
                {
                    Id = table.Column<Guid>(nullable: false),
                    Title = table.Column<string>(maxLength: 200, nullable: false),
                    Description = table.Column<string>(maxLength: 4000, nullable: false),
                    Type = table.Column<string>(maxLength: 30, nullable: false),
                    Difficulty = table.Column<string>(maxLength: 20, nullable: false),
                    GradingMethod = table.Column<string>(maxLength: 20, nullable: false),
                    Points = table.Column<int>(nullable: false),
                    DurationMinutes = table.Column<int>(nullable: false),
                    Tags = table.Column<string>(nullable: false),
                    UsageCount = table.Column<int>(nullable: false, defaultValue: 0),
                    Language = table.Column<string>(maxLength: 80, nullable: true),
                    StarterCode = table.Column<string>(nullable: true),
                    EvaluationCriteria = table.Column<string>(maxLength: 4000, nullable: true),
                    CreatedAt = table.Column<DateTime>(nullable: false),
                    UpdatedAt = table.Column<DateTime>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Questions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "QuestionOptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(nullable: false),
                    QuestionId = table.Column<Guid>(nullable: false),
                    Text = table.Column<string>(maxLength: 1000, nullable: false),
                    Correct = table.Column<bool>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionOptions_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "Questions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionOptions_QuestionId",
                table: "QuestionOptions",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_CreatedAt",
                table: "Questions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_Difficulty",
                table: "Questions",
                column: "Difficulty");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_GradingMethod",
                table: "Questions",
                column: "GradingMethod");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_Type",
                table: "Questions",
                column: "Type");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_UsageCount",
                table: "Questions",
                column: "UsageCount");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuestionOptions");

            migrationBuilder.DropTable(
                name: "Questions");
        }
    }
}

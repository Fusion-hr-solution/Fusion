using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    /// <inheritdoc />
    public partial class AddAutoGrading : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TestCases",
                table: "Questions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GradingStatus",
                table: "CandidateTestAttempts",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Pending");

            migrationBuilder.AddColumn<decimal>(
                name: "MaxScore",
                table: "CandidateTestAttempts",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalScore",
                table: "CandidateTestAttempts",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GradingJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    LockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LockedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FailedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ErrorMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    RetryCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GradingJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GradingJobs_CandidateTestAttempts_AttemptId",
                        column: x => x.AttemptId,
                        principalTable: "CandidateTestAttempts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuestionGradeResults",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    GraderType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Score = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    MaxScore = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    Feedback = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    NeedsHumanReview = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewedBy = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestionGradeResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuestionGradeResults_CandidateTestAttempts_AttemptId",
                        column: x => x.AttemptId,
                        principalTable: "CandidateTestAttempts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuestionGradeResults_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "Questions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GradingJobs_AttemptId",
                table: "GradingJobs",
                column: "AttemptId");

            migrationBuilder.CreateIndex(
                name: "IX_GradingJobs_LockedAt_CompletedAt",
                table: "GradingJobs",
                columns: new[] { "LockedAt", "CompletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionGradeResults_AttemptId",
                table: "QuestionGradeResults",
                column: "AttemptId");

            migrationBuilder.CreateIndex(
                name: "IX_QuestionGradeResults_NeedsHumanReview_ReviewedAt",
                table: "QuestionGradeResults",
                columns: new[] { "NeedsHumanReview", "ReviewedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_QuestionGradeResults_QuestionId",
                table: "QuestionGradeResults",
                column: "QuestionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GradingJobs");

            migrationBuilder.DropTable(
                name: "QuestionGradeResults");

            migrationBuilder.DropColumn(
                name: "TestCases",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "GradingStatus",
                table: "CandidateTestAttempts");

            migrationBuilder.DropColumn(
                name: "MaxScore",
                table: "CandidateTestAttempts");

            migrationBuilder.DropColumn(
                name: "TotalScore",
                table: "CandidateTestAttempts");
        }
    }
}

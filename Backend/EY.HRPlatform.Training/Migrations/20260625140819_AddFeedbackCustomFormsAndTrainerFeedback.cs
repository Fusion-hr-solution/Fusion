using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedbackCustomFormsAndTrainerFeedback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FeedbackQuestions",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Label = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    Options = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsRetired = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackQuestions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TrainerGroupFeedbacks",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrainerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupEngagement = table.Column<int>(type: "integer", nullable: false),
                    KnowledgeLevel = table.Column<int>(type: "integer", nullable: false),
                    Comments = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    PrerequisiteSuggestions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainerGroupFeedbacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrainerGroupFeedbacks_TrainingSessions_SessionId",
                        column: x => x.SessionId,
                        principalSchema: "training",
                        principalTable: "TrainingSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackAnswers",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FeedbackId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionLabelSnapshot = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    QuestionTypeSnapshot = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Value = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackAnswers_FeedbackQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalSchema: "training",
                        principalTable: "FeedbackQuestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FeedbackAnswers_TrainingFeedbacks_FeedbackId",
                        column: x => x.FeedbackId,
                        principalSchema: "training",
                        principalTable: "TrainingFeedbacks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackAnswers_FeedbackId",
                schema: "training",
                table: "FeedbackAnswers",
                column: "FeedbackId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackAnswers_QuestionId",
                schema: "training",
                table: "FeedbackAnswers",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackQuestions_CategoryId_Order",
                schema: "training",
                table: "FeedbackQuestions",
                columns: new[] { "CategoryId", "Order" });

            migrationBuilder.CreateIndex(
                name: "IX_TrainerGroupFeedbacks_SessionId_TrainerEmployeeId",
                schema: "training",
                table: "TrainerGroupFeedbacks",
                columns: new[] { "SessionId", "TrainerEmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrainerGroupFeedbacks_TrainerEmployeeId",
                schema: "training",
                table: "TrainerGroupFeedbacks",
                column: "TrainerEmployeeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FeedbackAnswers",
                schema: "training");

            migrationBuilder.DropTable(
                name: "TrainerGroupFeedbacks",
                schema: "training");

            migrationBuilder.DropTable(
                name: "FeedbackQuestions",
                schema: "training");
        }
    }
}

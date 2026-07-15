using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddTrainingFeedback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TrainingFeedbacks",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrainingId = table.Column<Guid>(type: "uuid", nullable: false),
                    OverallRating = table.Column<int>(type: "integer", nullable: false),
                    ContentRating = table.Column<int>(type: "integer", nullable: false),
                    RelevanceRating = table.Column<int>(type: "integer", nullable: false),
                    TrainerRating = table.Column<int>(type: "integer", nullable: true),
                    WouldRecommend = table.Column<bool>(type: "boolean", nullable: false),
                    Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Suggestions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsAnonymous = table.Column<bool>(type: "boolean", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingFeedbacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrainingFeedbacks_Trainings_TrainingId",
                        column: x => x.TrainingId,
                        principalSchema: "training",
                        principalTable: "Trainings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TrainingFeedbacks_EmployeeId_TrainingId",
                schema: "training",
                table: "TrainingFeedbacks",
                columns: new[] { "EmployeeId", "TrainingId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrainingFeedbacks_SubmittedAt",
                schema: "training",
                table: "TrainingFeedbacks",
                column: "SubmittedAt");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingFeedbacks_TrainingId",
                schema: "training",
                table: "TrainingFeedbacks",
                column: "TrainingId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrainingFeedbacks",
                schema: "training");
        }
    }
}

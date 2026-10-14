using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReviewAssessments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CalibrationEnabled",
                schema: "performance",
                table: "PerformanceReviews",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ManagerAssessmentDueDate",
                schema: "performance",
                table: "PerformanceReviews",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ManagerAssessmentOverallRating",
                schema: "performance",
                table: "PerformanceReviews",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ManagerAssessmentSavedAt",
                schema: "performance",
                table: "PerformanceReviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ManagerAssessmentSubmittedAt",
                schema: "performance",
                table: "PerformanceReviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ManagerAssessmentSummary",
                schema: "performance",
                table: "PerformanceReviews",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "SelfAssessmentEnabled",
                schema: "performance",
                table: "PerformanceReviews",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "SelfAssessmentOverallRating",
                schema: "performance",
                table: "PerformanceReviews",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SelfAssessmentSavedAt",
                schema: "performance",
                table: "PerformanceReviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SelfAssessmentSubmittedAt",
                schema: "performance",
                table: "PerformanceReviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SelfAssessmentSummary",
                schema: "performance",
                table: "PerformanceReviews",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CalibrationEnabled",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "ManagerAssessmentDueDate",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "ManagerAssessmentOverallRating",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "ManagerAssessmentSavedAt",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "ManagerAssessmentSubmittedAt",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "ManagerAssessmentSummary",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SelfAssessmentEnabled",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SelfAssessmentOverallRating",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SelfAssessmentSavedAt",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SelfAssessmentSubmittedAt",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SelfAssessmentSummary",
                schema: "performance",
                table: "PerformanceReviews");
        }
    }
}

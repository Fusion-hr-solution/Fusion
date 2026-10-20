using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCalibrationPotentialBandsAndSummaryRevision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CalibrationChangedRating",
                schema: "performance",
                table: "PerformanceReviews",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "FinalPotential",
                schema: "performance",
                table: "PerformanceReviews",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SummaryCheckedAt",
                schema: "performance",
                table: "PerformanceReviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SummaryRevisedAt",
                schema: "performance",
                table: "PerformanceReviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SummaryRevisedByEmployeeId",
                schema: "performance",
                table: "PerformanceReviews",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NineBoxLowTop",
                schema: "performance",
                table: "CycleSettings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NineBoxMidTop",
                schema: "performance",
                table: "CycleSettings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CalibratedPotential",
                schema: "performance",
                table: "CalibrationSubjects",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OriginalPotential",
                schema: "performance",
                table: "CalibrationSubjects",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BandLowTop",
                schema: "performance",
                table: "CalibrationSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "BandMidTop",
                schema: "performance",
                table: "CalibrationSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "NewPotential",
                schema: "performance",
                table: "CalibrationAdjustments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviousPotential",
                schema: "performance",
                table: "CalibrationAdjustments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            // Existing sessions take the default bands for their round's scale (n levels: low ⌊(n+1)/3⌋, middle ⌊n/3⌋).
            migrationBuilder.Sql("""
                UPDATE performance."CalibrationSessions" AS s
                SET "BandLowTop" = (l.n + 1) / 3, "BandMidTop" = (l.n + 1) / 3 + l.n / 3
                FROM (
                    SELECT r."Id" AS round_id, COALESCE(jsonb_array_length(v."Levels"), 5) AS n
                    FROM performance."ReviewRounds" r
                    LEFT JOIN performance."RatingScaleVersions" v ON v."Id" = r."RatingScaleVersionId"
                ) AS l
                WHERE l.round_id = s."ReviewRoundId";
                """);
            // Subjects already in a session keep the manager's potential as their original.
            migrationBuilder.Sql("""
                UPDATE performance."CalibrationSubjects" AS c
                SET "OriginalPotential" = p."Potential"
                FROM performance."PerformanceReviews" p
                WHERE p."Id" = c."ReviewId" AND p."Potential" IS NOT NULL;
                """);
            // Reviews past calibration: the final potential is the manager's (nothing calibrated potential before),
            // and an unreleased review whose calibrated rating differs from the manager's opens the summary check.
            migrationBuilder.Sql("""
                UPDATE performance."PerformanceReviews"
                SET "FinalPotential" = "Potential"
                WHERE "Potential" IS NOT NULL AND "State" IN ('ReadyToFinalize', 'Finalized');
                UPDATE performance."PerformanceReviews"
                SET "CalibrationChangedRating" = TRUE
                WHERE "State" = 'ReadyToFinalize' AND "FinalRatingSource" = 'Calibration'
                  AND "FinalRating" IS DISTINCT FROM "ManagerAssessmentOverallRating";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CalibrationChangedRating",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "FinalPotential",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SummaryCheckedAt",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SummaryRevisedAt",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SummaryRevisedByEmployeeId",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "NineBoxLowTop",
                schema: "performance",
                table: "CycleSettings");

            migrationBuilder.DropColumn(
                name: "NineBoxMidTop",
                schema: "performance",
                table: "CycleSettings");

            migrationBuilder.DropColumn(
                name: "CalibratedPotential",
                schema: "performance",
                table: "CalibrationSubjects");

            migrationBuilder.DropColumn(
                name: "OriginalPotential",
                schema: "performance",
                table: "CalibrationSubjects");

            migrationBuilder.DropColumn(
                name: "BandLowTop",
                schema: "performance",
                table: "CalibrationSessions");

            migrationBuilder.DropColumn(
                name: "BandMidTop",
                schema: "performance",
                table: "CalibrationSessions");

            migrationBuilder.DropColumn(
                name: "NewPotential",
                schema: "performance",
                table: "CalibrationAdjustments");

            migrationBuilder.DropColumn(
                name: "PreviousPotential",
                schema: "performance",
                table: "CalibrationAdjustments");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FinalizePerformanceReviews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CloseReason",
                schema: "performance",
                table: "PerformanceReviews",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ClosedAt",
                schema: "performance",
                table: "PerformanceReviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FinalRating",
                schema: "performance",
                table: "PerformanceReviews",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinalRatingSource",
                schema: "performance",
                table: "PerformanceReviews",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FinalizedAt",
                schema: "performance",
                table: "PerformanceReviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinalizedSnapshotJson",
                schema: "performance",
                table: "PerformanceReviews",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CloseReason",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "ClosedAt",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "FinalRating",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "FinalRatingSource",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "FinalizedAt",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "FinalizedSnapshotJson",
                schema: "performance",
                table: "PerformanceReviews");
        }
    }
}

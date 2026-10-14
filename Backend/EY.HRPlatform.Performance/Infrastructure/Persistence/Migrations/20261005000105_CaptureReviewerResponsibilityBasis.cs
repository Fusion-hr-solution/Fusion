using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CaptureReviewerResponsibilityBasis : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "ReviewerAsOf",
                schema: "performance",
                table: "Participants",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.AddColumn<string>(
                name: "ReviewerBasis",
                schema: "performance",
                table: "Participants",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "CoreManagerAtCycleStart");

            // Existing participants were captured at confirmation from the Core manager as of the
            // eligibility date (the Cycle start), so backfill exactly that basis and date.
            migrationBuilder.Sql("""
                UPDATE performance."Participants" AS p
                SET "ReviewerAsOf" = COALESCE(d."EligibilityDate", c."StartDate")
                FROM performance."PerformanceCycles" AS c
                LEFT JOIN performance."PopulationDefinitions" AS d ON d."CycleId" = c."Id"
                WHERE c."Id" = p."CycleId";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReviewerAsOf",
                schema: "performance",
                table: "Participants");

            migrationBuilder.DropColumn(
                name: "ReviewerBasis",
                schema: "performance",
                table: "Participants");
        }
    }
}

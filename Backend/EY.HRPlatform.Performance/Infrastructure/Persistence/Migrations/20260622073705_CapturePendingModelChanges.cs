using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class CapturePendingModelChanges : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // The three preceding hand-authored migrations create the campaign,
        // governance, and formal-review schema represented by this migration's
        // model snapshot. Only their relationship constraints were omitted.
        migrationBuilder.AddForeignKey(
            name: "FK_CampaignExceptionOwners_PerformanceCycles_CycleId",
            schema: "performance",
            table: "CampaignExceptionOwners",
            column: "CycleId",
            principalSchema: "performance",
            principalTable: "PerformanceCycles",
            principalColumn: "Id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "FK_FormalRatingScaleLevelSnapshots_FormalReviewDefinitionSnaps~",
            schema: "performance",
            table: "FormalRatingScaleLevelSnapshots",
            column: "DefinitionSnapshotId",
            principalSchema: "performance",
            principalTable: "FormalReviewDefinitionSnapshots",
            principalColumn: "Id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "FK_FormalReviewCriterionSnapshots_FormalReviewDefinitionSnapsh~",
            schema: "performance",
            table: "FormalReviewCriterionSnapshots",
            column: "DefinitionSnapshotId",
            principalSchema: "performance",
            principalTable: "FormalReviewDefinitionSnapshots",
            principalColumn: "Id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "FK_PerformanceReviewCriterionResponses_PerformanceReviews_Revi~",
            schema: "performance",
            table: "PerformanceReviewCriterionResponses",
            column: "ReviewId",
            principalSchema: "performance",
            principalTable: "PerformanceReviews",
            principalColumn: "Id",
            onDelete: ReferentialAction.Cascade);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_CampaignExceptionOwners_PerformanceCycles_CycleId",
            schema: "performance",
            table: "CampaignExceptionOwners");

        migrationBuilder.DropForeignKey(
            name: "FK_FormalRatingScaleLevelSnapshots_FormalReviewDefinitionSnaps~",
            schema: "performance",
            table: "FormalRatingScaleLevelSnapshots");

        migrationBuilder.DropForeignKey(
            name: "FK_FormalReviewCriterionSnapshots_FormalReviewDefinitionSnapsh~",
            schema: "performance",
            table: "FormalReviewCriterionSnapshots");

        migrationBuilder.DropForeignKey(
            name: "FK_PerformanceReviewCriterionResponses_PerformanceReviews_Revi~",
            schema: "performance",
            table: "PerformanceReviewCriterionResponses");
    }
}

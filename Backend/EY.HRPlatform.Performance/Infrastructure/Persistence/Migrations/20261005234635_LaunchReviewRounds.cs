using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LaunchReviewRounds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ConfigSnapshotJson",
                schema: "performance",
                table: "ReviewRounds",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LaunchedAt",
                schema: "performance",
                table: "ReviewRounds",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RatingScaleVersionId",
                schema: "performance",
                table: "ReviewRounds",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PerformanceReviews",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewRoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectDisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ReviewerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerDisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    RatingScaleVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    RatingScaleSnapshotJson = table.Column<string>(type: "jsonb", nullable: false),
                    State = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CurrentStageDueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceReviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformanceReviews_RatingScaleVersions_RatingScaleVersionId",
                        column: x => x.RatingScaleVersionId,
                        principalSchema: "performance",
                        principalTable: "RatingScaleVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PerformanceReviews_ReviewRounds_ReviewRoundId",
                        column: x => x.ReviewRoundId,
                        principalSchema: "performance",
                        principalTable: "ReviewRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRounds_RatingScaleVersionId",
                schema: "performance",
                table: "ReviewRounds",
                column: "RatingScaleVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviews_RatingScaleVersionId",
                schema: "performance",
                table: "PerformanceReviews",
                column: "RatingScaleVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviews_ReviewerEmployeeId",
                schema: "performance",
                table: "PerformanceReviews",
                column: "ReviewerEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviews_ReviewRoundId",
                schema: "performance",
                table: "PerformanceReviews",
                column: "ReviewRoundId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviews_TenantId",
                schema: "performance",
                table: "PerformanceReviews",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviews_TenantId_CycleId_State",
                schema: "performance",
                table: "PerformanceReviews",
                columns: new[] { "TenantId", "CycleId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviews_TenantId_ReviewRoundId_SubjectEmployeeId",
                schema: "performance",
                table: "PerformanceReviews",
                columns: new[] { "TenantId", "ReviewRoundId", "SubjectEmployeeId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ReviewRounds_RatingScaleVersions_RatingScaleVersionId",
                schema: "performance",
                table: "ReviewRounds",
                column: "RatingScaleVersionId",
                principalSchema: "performance",
                principalTable: "RatingScaleVersions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ReviewRounds_RatingScaleVersions_RatingScaleVersionId",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropTable(
                name: "PerformanceReviews",
                schema: "performance");

            migrationBuilder.DropIndex(
                name: "IX_ReviewRounds_RatingScaleVersionId",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropColumn(
                name: "ConfigSnapshotJson",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropColumn(
                name: "LaunchedAt",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropColumn(
                name: "RatingScaleVersionId",
                schema: "performance",
                table: "ReviewRounds");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReviewItemResponses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ObjectiveRatingsEnabled",
                schema: "performance",
                table: "PerformanceReviews",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("""
                UPDATE performance."PerformanceReviews" AS review
                SET "ObjectiveRatingsEnabled" = round."ObjectiveRatingsEnabled"
                FROM performance."ReviewRounds" AS round
                WHERE review."ReviewRoundId" = round."Id";
                """);

            migrationBuilder.CreateTable(
                name: "ReviewItemResponses",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    SelfReflection = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    SelfRating = table.Column<int>(type: "integer", nullable: true),
                    SelfComment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ManagerAssessment = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    ManagerRating = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewItemResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewItemResponses_PerformanceReviews_ReviewId",
                        column: x => x.ReviewId,
                        principalSchema: "performance",
                        principalTable: "PerformanceReviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReviewItemResponses_ReviewId",
                schema: "performance",
                table: "ReviewItemResponses",
                column: "ReviewId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewItemResponses_TenantId",
                schema: "performance",
                table: "ReviewItemResponses",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewItemResponses_TenantId_ReviewId_Kind_ItemId",
                schema: "performance",
                table: "ReviewItemResponses",
                columns: new[] { "TenantId", "ReviewId", "Kind", "ItemId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReviewItemResponses",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "ObjectiveRatingsEnabled",
                schema: "performance",
                table: "PerformanceReviews");
        }
    }
}

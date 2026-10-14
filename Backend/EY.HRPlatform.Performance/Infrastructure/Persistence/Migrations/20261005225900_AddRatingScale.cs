using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRatingScale : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "DefaultCalibrationEnabled",
                schema: "performance",
                table: "CycleSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "DefaultObjectiveRatingsEnabled",
                schema: "performance",
                table: "CycleSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "DefaultSelfAssessmentEnabled",
                schema: "performance",
                table: "CycleSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "RatingScales",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CurrentVersionId = table.Column<Guid>(type: "uuid", nullable: true),
                    CurrentVersionNumber = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RatingScales", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RatingScaleVersions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RatingScaleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    Levels = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RatingScaleVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RatingScaleVersions_RatingScales_RatingScaleId",
                        column: x => x.RatingScaleId,
                        principalSchema: "performance",
                        principalTable: "RatingScales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RatingScales_CurrentVersionId",
                schema: "performance",
                table: "RatingScales",
                column: "CurrentVersionId",
                unique: true,
                filter: "\"CurrentVersionId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_RatingScales_TenantId",
                schema: "performance",
                table: "RatingScales",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RatingScaleVersions_RatingScaleId_Number",
                schema: "performance",
                table: "RatingScaleVersions",
                columns: new[] { "RatingScaleId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RatingScaleVersions_TenantId",
                schema: "performance",
                table: "RatingScaleVersions",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RatingScaleVersions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "RatingScales",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "DefaultCalibrationEnabled",
                schema: "performance",
                table: "CycleSettings");

            migrationBuilder.DropColumn(
                name: "DefaultObjectiveRatingsEnabled",
                schema: "performance",
                table: "CycleSettings");

            migrationBuilder.DropColumn(
                name: "DefaultSelfAssessmentEnabled",
                schema: "performance",
                table: "CycleSettings");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlatformDefaultsP11Realignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'performance'
                          AND table_name = 'PlatformStarterTemplates')
                    AND EXISTS (
                        SELECT 1
                        FROM performance."PlatformStarterTemplates"
                        LIMIT 1)
                    THEN
                        RAISE EXCEPTION 'PlatformDefaultsP11Realignment aborted: performance."PlatformStarterTemplates" still contains data. Export or preserve the starter templates before applying this migration.';
                    END IF;
                END
                $$;
                """);

            migrationBuilder.DropTable(
                name: "PlatformStarterTemplates",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "ObjectiveLibraryEnabled",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "IsDraft",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ObjectiveLibraryEnabled",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsDraft",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "PlatformStarterTemplates",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    MeasurementType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Qualitative"),
                    SortOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    SuccessCriteria = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SuggestedWeighting = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    Tags = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TargetValue = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Unit = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformStarterTemplates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlatformStarterTemplates_IsActive",
                schema: "performance",
                table: "PlatformStarterTemplates",
                column: "IsActive");
        }
    }
}

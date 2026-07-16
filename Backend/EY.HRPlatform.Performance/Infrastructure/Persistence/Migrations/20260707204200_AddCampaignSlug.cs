using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCampaignSlug : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Slug",
                schema: "performance",
                table: "PerformanceCycles",
                type: "character varying(240)",
                maxLength: 240,
                nullable: false,
                defaultValue: "");

            // Backfill a readable, tenant-unique slug for any pre-existing campaigns. New rows get a
            // clean slug from the create handler; legacy rows are suffixed with a short Id fragment so
            // the unique (TenantId, Slug) index below can never collide, even on duplicate names.
            migrationBuilder.Sql(
                """
                UPDATE performance."PerformanceCycles"
                SET "Slug" = left(
                    trim(both '-' from regexp_replace(lower("Name"), '[^a-z0-9]+', '-', 'g'))
                        || '-' || COALESCE("ReferenceYear", EXTRACT(YEAR FROM "PeriodStart")::int)::text
                        || '-' || left("Id"::text, 8),
                    240)
                WHERE "Slug" = '';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCycles_TenantId_Slug",
                schema: "performance",
                table: "PerformanceCycles",
                columns: new[] { "TenantId", "Slug" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PerformanceCycles_TenantId_Slug",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "Slug",
                schema: "performance",
                table: "PerformanceCycles");
        }
    }
}

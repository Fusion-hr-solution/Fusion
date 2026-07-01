using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantSlug : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Slug",
                schema: "identity",
                table: "Tenants",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.Sql(
                """
                WITH base_slugs AS (
                    SELECT
                        "Id",
                        CASE
                            WHEN trimmed_slug = '' THEN 'tenant'
                            ELSE trimmed_slug
                        END AS base_slug
                    FROM (
                        SELECT
                            "Id",
                            BTRIM(REGEXP_REPLACE(LOWER(COALESCE("Name", 'tenant')), '[^a-z0-9]+', '-', 'g'), '-') AS trimmed_slug
                        FROM identity."Tenants"
                    ) normalized
                ),
                deduped AS (
                    SELECT
                        "Id",
                        base_slug,
                        ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY "Id") AS ordinal
                    FROM base_slugs
                )
                UPDATE identity."Tenants" AS tenants
                SET "Slug" = CASE
                    WHEN deduped.ordinal = 1 THEN deduped.base_slug
                    ELSE deduped.base_slug || '-' || deduped.ordinal
                END
                FROM deduped
                WHERE tenants."Id" = deduped."Id"
                  AND (tenants."Slug" IS NULL OR tenants."Slug" = '');
                """);

            migrationBuilder.AlterColumn<string>(
                name: "Slug",
                schema: "identity",
                table: "Tenants",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_Slug",
                schema: "identity",
                table: "Tenants",
                column: "Slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tenants_Slug",
                schema: "identity",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "Slug",
                schema: "identity",
                table: "Tenants");
        }
    }
}

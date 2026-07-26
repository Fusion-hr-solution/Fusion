using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSkillsNormalizedNameUniqueness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_Skills_Tenant_ActiveName",
                schema: "performance",
                table: "Skills");

            migrationBuilder.DropIndex(
                name: "UX_SkillExpectationSets_Tenant_ActiveName",
                schema: "performance",
                table: "SkillExpectationSets");

            migrationBuilder.DropIndex(
                name: "UX_SkillCategories_Tenant_ActiveName",
                schema: "performance",
                table: "SkillCategories");

            migrationBuilder.DropIndex(
                name: "UX_ProficiencyScales_Tenant_ActiveName",
                schema: "performance",
                table: "ProficiencyScales");

            migrationBuilder.AddColumn<string>(
                name: "NormalizedName",
                schema: "performance",
                table: "Skills",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NormalizedName",
                schema: "performance",
                table: "SkillExpectationSets",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NormalizedName",
                schema: "performance",
                table: "SkillCategories",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NormalizedName",
                schema: "performance",
                table: "ProficiencyScales",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            // Backfill with collision preflight: pre-existing non-archived rows whose names differ
            // only by case get a deterministic " (n)" suffix (oldest row keeps its name) so the
            // unique index below always applies cleanly on live tenant data.
            migrationBuilder.Sql("""
                DO $$
                DECLARE
                    t RECORD;
                BEGIN
                    FOR t IN SELECT * FROM (VALUES
                        ('Skills', 120), ('SkillExpectationSets', 120), ('SkillCategories', 80), ('ProficiencyScales', 120)
                    ) AS v(tbl, maxlen)
                    LOOP
                        EXECUTE format($f$
                            WITH ranked AS (
                                SELECT "Id", ROW_NUMBER() OVER (
                                    PARTITION BY "TenantId", UPPER("Name")
                                    ORDER BY "CreatedAt", "Id") AS rn
                                FROM performance.%1$I
                                WHERE "Status" <> 'Archived'
                            )
                            UPDATE performance.%1$I AS x
                            SET "Name" = LEFT(x."Name", %2$s - 8) || ' (' || ranked.rn || ')'
                            FROM ranked
                            WHERE x."Id" = ranked."Id" AND ranked.rn > 1
                        $f$, t.tbl, t.maxlen);
                        EXECUTE format('UPDATE performance.%1$I SET "NormalizedName" = UPPER("Name")', t.tbl);
                    END LOOP;
                END $$;
                """);

            migrationBuilder.CreateIndex(
                name: "UX_Skills_Tenant_ActiveNormalizedName",
                schema: "performance",
                table: "Skills",
                columns: new[] { "TenantId", "NormalizedName" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");

            migrationBuilder.CreateIndex(
                name: "UX_SkillExpectationSets_Tenant_ActiveNormalizedName",
                schema: "performance",
                table: "SkillExpectationSets",
                columns: new[] { "TenantId", "NormalizedName" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");

            migrationBuilder.CreateIndex(
                name: "UX_SkillCategories_Tenant_ActiveNormalizedName",
                schema: "performance",
                table: "SkillCategories",
                columns: new[] { "TenantId", "NormalizedName" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");

            migrationBuilder.CreateIndex(
                name: "UX_ProficiencyScales_Tenant_ActiveNormalizedName",
                schema: "performance",
                table: "ProficiencyScales",
                columns: new[] { "TenantId", "NormalizedName" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_Skills_Tenant_ActiveNormalizedName",
                schema: "performance",
                table: "Skills");

            migrationBuilder.DropIndex(
                name: "UX_SkillExpectationSets_Tenant_ActiveNormalizedName",
                schema: "performance",
                table: "SkillExpectationSets");

            migrationBuilder.DropIndex(
                name: "UX_SkillCategories_Tenant_ActiveNormalizedName",
                schema: "performance",
                table: "SkillCategories");

            migrationBuilder.DropIndex(
                name: "UX_ProficiencyScales_Tenant_ActiveNormalizedName",
                schema: "performance",
                table: "ProficiencyScales");

            migrationBuilder.DropColumn(
                name: "NormalizedName",
                schema: "performance",
                table: "Skills");

            migrationBuilder.DropColumn(
                name: "NormalizedName",
                schema: "performance",
                table: "SkillExpectationSets");

            migrationBuilder.DropColumn(
                name: "NormalizedName",
                schema: "performance",
                table: "SkillCategories");

            migrationBuilder.DropColumn(
                name: "NormalizedName",
                schema: "performance",
                table: "ProficiencyScales");

            migrationBuilder.CreateIndex(
                name: "UX_Skills_Tenant_ActiveName",
                schema: "performance",
                table: "Skills",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");

            migrationBuilder.CreateIndex(
                name: "UX_SkillExpectationSets_Tenant_ActiveName",
                schema: "performance",
                table: "SkillExpectationSets",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");

            migrationBuilder.CreateIndex(
                name: "UX_SkillCategories_Tenant_ActiveName",
                schema: "performance",
                table: "SkillCategories",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");

            migrationBuilder.CreateIndex(
                name: "UX_ProficiencyScales_Tenant_ActiveName",
                schema: "performance",
                table: "ProficiencyScales",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");
        }
    }
}

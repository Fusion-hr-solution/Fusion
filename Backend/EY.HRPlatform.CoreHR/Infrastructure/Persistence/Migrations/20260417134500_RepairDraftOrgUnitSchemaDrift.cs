using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CoreHRDbContext))]
[Migration("20260417134500_RepairDraftOrgUnitSchemaDrift")]
public partial class RepairDraftOrgUnitSchemaDrift : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits') THEN
                    RETURN;
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits'
                      AND column_name = 'Code')
                   AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits'
                      AND column_name = 'ReferenceKey') THEN
                    ALTER TABLE corehr."DraftOrgUnits"
                        RENAME COLUMN "Code" TO "ReferenceKey";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits'
                      AND column_name = 'Name')
                   AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits'
                      AND column_name = 'DisplayName') THEN
                    ALTER TABLE corehr."DraftOrgUnits"
                        RENAME COLUMN "Name" TO "DisplayName";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits'
                      AND column_name = 'Type')
                   AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits'
                      AND column_name = 'OrgUnitKindKey') THEN
                    ALTER TABLE corehr."DraftOrgUnits"
                        RENAME COLUMN "Type" TO "OrgUnitKindKey";
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits'
                      AND column_name = 'AttributesJson') THEN
                    ALTER TABLE corehr."DraftOrgUnits"
                        ADD COLUMN "AttributesJson" jsonb NULL;
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits'
                      AND column_name = 'Location') THEN
                    ALTER TABLE corehr."DraftOrgUnits"
                        ADD COLUMN "Location" character varying(100) NULL;
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits'
                      AND column_name = 'Description') THEN
                    ALTER TABLE corehr."DraftOrgUnits"
                        ADD COLUMN "Description" character varying(500) NULL;
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits'
                      AND column_name = 'NormalizedReferenceKey') THEN
                    ALTER TABLE corehr."DraftOrgUnits"
                        ADD COLUMN "NormalizedReferenceKey" character varying(150) NULL;
                END IF;

                ALTER TABLE corehr."DraftOrgUnits"
                    ALTER COLUMN "ReferenceKey" TYPE character varying(150);

                ALTER TABLE corehr."DraftOrgUnits"
                    ALTER COLUMN "DisplayName" TYPE character varying(200);

                ALTER TABLE corehr."DraftOrgUnits"
                    ALTER COLUMN "OrgUnitKindKey" TYPE character varying(100);

                ALTER TABLE corehr."DraftOrgUnits"
                    ALTER COLUMN "Location" TYPE character varying(100);

                ALTER TABLE corehr."DraftOrgUnits"
                    ALTER COLUMN "Description" TYPE character varying(500);

                ALTER TABLE corehr."DraftOrgUnits"
                    ALTER COLUMN "NormalizedReferenceKey" TYPE character varying(150);

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'corehr'
                      AND table_name = 'DraftOrgUnits'
                      AND column_name = 'BusinessCode') THEN
                    UPDATE corehr."DraftOrgUnits"
                    SET "Location" = NULLIF(BTRIM("BusinessCode"), '')
                    WHERE "Location" IS NULL
                      AND NULLIF(BTRIM("BusinessCode"), '') IS NOT NULL;
                END IF;

                UPDATE corehr."DraftOrgUnits"
                SET "ReferenceKey" = COALESCE(NULLIF(BTRIM("ReferenceKey"), ''), "Id"::text)
                WHERE "ReferenceKey" IS NULL
                   OR BTRIM("ReferenceKey") = '';

                UPDATE corehr."DraftOrgUnits"
                SET "DisplayName" = COALESCE(NULLIF(BTRIM("DisplayName"), ''), "ReferenceKey")
                WHERE "DisplayName" IS NULL
                   OR BTRIM("DisplayName") = '';

                UPDATE corehr."DraftOrgUnits"
                SET "OrgUnitKindKey" = LOWER(COALESCE(NULLIF(BTRIM("OrgUnitKindKey"), ''), 'department'))
                WHERE "OrgUnitKindKey" IS NULL
                   OR BTRIM("OrgUnitKindKey") = ''
                   OR "OrgUnitKindKey" <> LOWER("OrgUnitKindKey");

                UPDATE corehr."DraftOrgUnits"
                SET "NormalizedReferenceKey" = UPPER(BTRIM("ReferenceKey"))
                WHERE "NormalizedReferenceKey" IS NULL
                   OR BTRIM("NormalizedReferenceKey") = ''
                   OR "NormalizedReferenceKey" <> UPPER(BTRIM("ReferenceKey"));

                ALTER TABLE corehr."DraftOrgUnits"
                    ALTER COLUMN "ReferenceKey" SET NOT NULL;

                ALTER TABLE corehr."DraftOrgUnits"
                    ALTER COLUMN "DisplayName" SET NOT NULL;

                ALTER TABLE corehr."DraftOrgUnits"
                    ALTER COLUMN "OrgUnitKindKey" SET NOT NULL;

                ALTER TABLE corehr."DraftOrgUnits"
                    ALTER COLUMN "NormalizedReferenceKey" SET NOT NULL;
            END $$;
            """);

        migrationBuilder.Sql(
            """
            DROP INDEX IF EXISTS corehr."IX_DraftOrgUnits_TenantId_Code";
            DROP INDEX IF EXISTS corehr."IX_DraftOrgUnits_TenantId_Name";

            CREATE INDEX IF NOT EXISTS "IX_DraftOrgUnits_TenantId"
                ON corehr."DraftOrgUnits" ("TenantId");

            CREATE INDEX IF NOT EXISTS "IX_DraftOrgUnits_ParentId"
                ON corehr."DraftOrgUnits" ("ParentId");

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_DraftOrgUnits_TenantId_NormalizedReferenceKey"
                ON corehr."DraftOrgUnits" ("TenantId", "NormalizedReferenceKey");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
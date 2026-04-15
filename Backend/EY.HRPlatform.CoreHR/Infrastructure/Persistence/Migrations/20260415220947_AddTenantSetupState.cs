using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantSetupState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'corehr' AND table_name = 'TenantSetupStates'
                    ) THEN
                        CREATE TABLE corehr."TenantSetupStates" (
                            "Id" uuid NOT NULL,
                            "TenantId" uuid NOT NULL,
                            "CurrentPhase" character varying(64) NOT NULL,
                            "ActivatedAt" timestamp with time zone NULL,
                            "StructurallyGovernedAt" timestamp with time zone NULL,
                            "StructurallyPublishedAt" timestamp with time zone NULL,
                            "OperationalAt" timestamp with time zone NULL,
                            "CreatedAt" timestamp with time zone NOT NULL,
                            "UpdatedAt" timestamp with time zone NULL,
                            "CreatedBy" character varying(256) NULL,
                            "UpdatedBy" character varying(256) NULL,
                            CONSTRAINT "PK_TenantSetupStates" PRIMARY KEY ("Id")
                        );
                    ELSE
                        ALTER TABLE corehr."TenantSetupStates"
                            ADD COLUMN IF NOT EXISTS "CurrentPhase" character varying(64) NOT NULL DEFAULT 'Activated',
                            ADD COLUMN IF NOT EXISTS "ActivatedAt" timestamp with time zone NULL,
                            ADD COLUMN IF NOT EXISTS "StructurallyGovernedAt" timestamp with time zone NULL,
                            ADD COLUMN IF NOT EXISTS "StructurallyPublishedAt" timestamp with time zone NULL,
                            ADD COLUMN IF NOT EXISTS "OperationalAt" timestamp with time zone NULL,
                            ADD COLUMN IF NOT EXISTS "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                            ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamp with time zone NULL,
                            ADD COLUMN IF NOT EXISTS "CreatedBy" character varying(256) NULL,
                            ADD COLUMN IF NOT EXISTS "UpdatedBy" character varying(256) NULL;
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_TenantSetupStates_TenantId"
                ON corehr."TenantSetupStates" ("TenantId");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TenantSetupStates",
                schema: "corehr");
        }
    }
}

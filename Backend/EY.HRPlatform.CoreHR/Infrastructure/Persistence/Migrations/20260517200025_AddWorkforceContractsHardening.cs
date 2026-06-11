using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkforceContractsHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                @"
                    ALTER TABLE corehr.""TenantSetupStates""
                    ADD COLUMN IF NOT EXISTS ""PublishedStructureVersion"" integer NOT NULL DEFAULT 0;

                    ALTER TABLE corehr.""Employees""
                    ADD COLUMN IF NOT EXISTS ""EmployeeNumber"" character varying(64) NULL;

                    CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Employees_TenantId_EmployeeNumber""
                    ON corehr.""Employees"" (""TenantId"", ""EmployeeNumber"")
                    WHERE ""EmployeeNumber"" IS NOT NULL;
                ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                @"
                    DROP INDEX IF EXISTS corehr.""IX_Employees_TenantId_EmployeeNumber"";

                    ALTER TABLE corehr.""TenantSetupStates""
                    DROP COLUMN IF EXISTS ""PublishedStructureVersion"";

                    ALTER TABLE corehr.""Employees""
                    DROP COLUMN IF EXISTS ""EmployeeNumber"";
                ");
        }
    }
}

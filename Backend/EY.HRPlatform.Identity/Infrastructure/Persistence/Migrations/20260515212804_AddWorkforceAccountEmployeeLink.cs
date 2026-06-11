using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkforceAccountEmployeeLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE identity."InviteTokens" ADD COLUMN IF NOT EXISTS "EmployeeId" uuid;
                ALTER TABLE identity."AspNetUsers" ADD COLUMN IF NOT EXISTS "EmployeeId" uuid;
                CREATE INDEX IF NOT EXISTS "IX_InviteTokens_TenantId_EmployeeId"
                    ON identity."InviteTokens" ("TenantId", "EmployeeId");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_AspNetUsers_TenantId_EmployeeId"
                    ON identity."AspNetUsers" ("TenantId", "EmployeeId")
                    WHERE "EmployeeId" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS identity."IX_InviteTokens_TenantId_EmployeeId";
                DROP INDEX IF EXISTS identity."IX_AspNetUsers_TenantId_EmployeeId";
                ALTER TABLE identity."InviteTokens" DROP COLUMN IF EXISTS "EmployeeId";
                ALTER TABLE identity."AspNetUsers" DROP COLUMN IF EXISTS "EmployeeId";
                """);
        }
    }
}

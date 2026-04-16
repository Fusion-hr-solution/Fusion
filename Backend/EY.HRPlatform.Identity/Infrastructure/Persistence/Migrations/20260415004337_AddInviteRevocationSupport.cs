using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInviteRevocationSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "DROP INDEX CONCURRENTLY IF EXISTS identity.\"IX_InviteTokens_TenantId_Email_Pending\";",
                suppressTransaction: true);

            migrationBuilder.Sql(
                "ALTER TABLE identity.\"InviteTokens\" ADD COLUMN IF NOT EXISTS \"IsRevoked\" boolean NOT NULL DEFAULT FALSE;");

            migrationBuilder.Sql(
                "ALTER TABLE identity.\"InviteTokens\" ADD COLUMN IF NOT EXISTS \"RevokedAt\" timestamp with time zone;");

            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS \"IX_Tenants_Name_Active\" ON identity.\"Tenants\" (\"Name\") WHERE \"IsArchived\" = false;",
                suppressTransaction: true);

            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS \"IX_InviteTokens_TenantId_Email_Pending\" ON identity.\"InviteTokens\" (\"TenantId\", \"Email\") WHERE \"AcceptedAt\" IS NULL AND \"IsRevoked\" = false;",
                suppressTransaction: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "DROP INDEX CONCURRENTLY IF EXISTS identity.\"IX_Tenants_Name_Active\";",
                suppressTransaction: true);

            migrationBuilder.Sql(
                "DROP INDEX CONCURRENTLY IF EXISTS identity.\"IX_InviteTokens_TenantId_Email_Pending\";",
                suppressTransaction: true);

            migrationBuilder.Sql(
                "ALTER TABLE identity.\"InviteTokens\" DROP COLUMN IF EXISTS \"IsRevoked\";");

            migrationBuilder.Sql(
                "ALTER TABLE identity.\"InviteTokens\" DROP COLUMN IF EXISTS \"RevokedAt\";");

            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS \"IX_InviteTokens_TenantId_Email_Pending\" ON identity.\"InviteTokens\" (\"TenantId\", \"Email\") WHERE \"AcceptedAt\" IS NULL;",
                suppressTransaction: true);
        }
    }
}

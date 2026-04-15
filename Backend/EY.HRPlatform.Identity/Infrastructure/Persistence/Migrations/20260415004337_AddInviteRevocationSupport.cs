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
                "DROP INDEX IF EXISTS identity.\"IX_InviteTokens_TenantId_Email_Pending\";");

            migrationBuilder.Sql(
                "ALTER TABLE identity.\"InviteTokens\" ADD COLUMN IF NOT EXISTS \"IsRevoked\" boolean NOT NULL DEFAULT FALSE;");

            migrationBuilder.Sql(
                "ALTER TABLE identity.\"InviteTokens\" ADD COLUMN IF NOT EXISTS \"RevokedAt\" timestamp with time zone;");

            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Tenants_Name_Active\" ON identity.\"Tenants\" (\"Name\") WHERE \"IsArchived\" = false;");

            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_InviteTokens_TenantId_Email_Pending\" ON identity.\"InviteTokens\" (\"TenantId\", \"Email\") WHERE \"AcceptedAt\" IS NULL AND \"IsRevoked\" = false;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "DROP INDEX IF EXISTS identity.\"IX_Tenants_Name_Active\";");

            migrationBuilder.Sql(
                "DROP INDEX IF EXISTS identity.\"IX_InviteTokens_TenantId_Email_Pending\";");

            migrationBuilder.Sql(
                "ALTER TABLE identity.\"InviteTokens\" DROP COLUMN IF EXISTS \"IsRevoked\";");

            migrationBuilder.Sql(
                "ALTER TABLE identity.\"InviteTokens\" DROP COLUMN IF EXISTS \"RevokedAt\";");

            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_InviteTokens_TenantId_Email_Pending\" ON identity.\"InviteTokens\" (\"TenantId\", \"Email\") WHERE \"AcceptedAt\" IS NULL;");
        }
    }
}

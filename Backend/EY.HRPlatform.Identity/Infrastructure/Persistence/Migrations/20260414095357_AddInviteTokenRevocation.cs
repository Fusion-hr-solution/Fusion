using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInviteTokenRevocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use raw SQL with existence guards so this migration is safe regardless of
            // whether AddInviteRevocationSupport (April-15) was applied first on an
            // existing database.
            migrationBuilder.Sql(
                "DROP INDEX IF EXISTS identity.\"IX_InviteTokens_TenantId_Email_Pending\";");

            migrationBuilder.Sql(
                "ALTER TABLE identity.\"InviteTokens\" ADD COLUMN IF NOT EXISTS \"IsRevoked\" boolean NOT NULL DEFAULT FALSE;");

            migrationBuilder.Sql(
                "ALTER TABLE identity.\"InviteTokens\" ADD COLUMN IF NOT EXISTS \"RevokedAt\" timestamp with time zone NULL;");

            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_InviteTokens_TenantId_Email_Pending\" " +
                "ON identity.\"InviteTokens\" (\"TenantId\", \"Email\") " +
                "WHERE \"AcceptedAt\" IS NULL AND \"IsRevoked\" = false;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_Email_Pending",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "IsRevoked",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "RevokedAt",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId_Email_Pending",
                schema: "identity",
                table: "InviteTokens",
                columns: new[] { "TenantId", "Email" },
                unique: true,
                filter: "\"AcceptedAt\" IS NULL");
        }
    }
}

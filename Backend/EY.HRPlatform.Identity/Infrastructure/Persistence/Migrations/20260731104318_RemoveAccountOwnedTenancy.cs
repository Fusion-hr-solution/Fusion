using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAccountOwnedTenancy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Every refresh token issued before this cutover was minted from
            // account-owned tenancy, so it can still mint an access token carrying
            // a tenant claim that no membership authorizes. Revoke them all: the
            // next sign-in composes a session from membership truth instead.
            migrationBuilder.Sql("""
                UPDATE identity."RefreshTokens"
                SET "RevokedAt" = now()
                WHERE "RevokedAt" IS NULL;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Tenants_TenantId",
                schema: "identity",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_TenantId",
                schema: "identity",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_TenantId_EmployeeId",
                schema: "identity",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "identity",
                table: "AspNetUsers");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_EmployeeId",
                schema: "identity",
                table: "AspNetUsers",
                column: "EmployeeId",
                unique: true,
                filter: "\"EmployeeId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // This cutover is deliberately irreversible.
            //
            // Restoring AspNetUsers.TenantId would require inventing a tenant for
            // every account. It cannot be reconstructed: a Platform Administrator
            // legitimately has no customer tenant, and an account whose membership
            // ended has no current one either. Writing an all-zero placeholder to
            // satisfy the foreign key would fabricate tenancy that never existed
            // and silently reintroduce account-owned authority.
            //
            // Roll back by restoring the database from a backup taken before this
            // migration was applied.
            throw new NotSupportedException(
                "RemoveAccountOwnedTenancy cannot be reverted: account-owned tenancy "
                + "cannot be reconstructed from membership data. Restore from a backup "
                + "taken before this migration was applied.");
        }
    }
}

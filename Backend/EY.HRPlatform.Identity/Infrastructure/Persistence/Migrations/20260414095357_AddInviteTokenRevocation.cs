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
            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_Email_Pending",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.AddColumn<bool>(
                name: "IsRevoked",
                schema: "identity",
                table: "InviteTokens",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "RevokedAt",
                schema: "identity",
                table: "InviteTokens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_Name_Active",
                schema: "identity",
                table: "Tenants",
                column: "Name",
                unique: true,
                filter: "\"IsArchived\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId_Email_Pending",
                schema: "identity",
                table: "InviteTokens",
                columns: new[] { "TenantId", "Email" },
                unique: true,
                filter: "\"AcceptedAt\" IS NULL AND \"IsRevoked\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tenants_Name_Active",
                schema: "identity",
                table: "Tenants");

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

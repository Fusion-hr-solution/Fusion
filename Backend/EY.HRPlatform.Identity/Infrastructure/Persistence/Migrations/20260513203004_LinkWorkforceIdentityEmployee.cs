using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkWorkforceIdentityEmployee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EmployeeId",
                schema: "identity",
                table: "InviteTokens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "EmployeeId",
                schema: "identity",
                table: "AspNetUsers",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId_EmployeeId_Pending",
                schema: "identity",
                table: "InviteTokens",
                columns: new[] { "TenantId", "EmployeeId" },
                unique: true,
                filter: "\"EmployeeId\" IS NOT NULL AND \"AcceptedAt\" IS NULL AND \"IsRevoked\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_TenantId_EmployeeId",
                schema: "identity",
                table: "AspNetUsers",
                columns: new[] { "TenantId", "EmployeeId" },
                unique: true,
                filter: "\"EmployeeId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_EmployeeId_Pending",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_TenantId_EmployeeId",
                schema: "identity",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                schema: "identity",
                table: "AspNetUsers");
        }
    }
}

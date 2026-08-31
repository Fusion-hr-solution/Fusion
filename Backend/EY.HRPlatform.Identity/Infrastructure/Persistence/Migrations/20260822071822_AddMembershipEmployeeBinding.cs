using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMembershipEmployeeBinding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EmployeeId",
                schema: "identity",
                table: "TenantMemberships",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantMemberships_TenantId_EmployeeId",
                schema: "identity",
                table: "TenantMemberships",
                columns: new[] { "TenantId", "EmployeeId" },
                unique: true,
                filter: "\"EmployeeId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TenantMemberships_TenantId_EmployeeId",
                schema: "identity",
                table: "TenantMemberships");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                schema: "identity",
                table: "TenantMemberships");
        }
    }
}

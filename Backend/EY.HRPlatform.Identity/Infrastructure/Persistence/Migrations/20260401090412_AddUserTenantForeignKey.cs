using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserTenantForeignKey : Migration
    {
        // Demo tenant ID for migrating existing users (from DemoConstants)
        private static readonly Guid DemoTenantId = new("11111111-1111-1111-1111-111111111111");

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Add TenantId column as nullable first
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "identity",
                table: "AspNetUsers",
                type: "uuid",
                nullable: true);

            // Step 2: Set all existing users to demo tenant
            migrationBuilder.Sql($"""
                UPDATE "identity"."AspNetUsers"
                SET "TenantId" = '{DemoTenantId}'
                WHERE "TenantId" IS NULL
                """);

            // Step 3: Make TenantId required
            migrationBuilder.AlterColumn<Guid>(
                name: "TenantId",
                schema: "identity",
                table: "AspNetUsers",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            // Step 4: Add index and FK constraint
            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_TenantId",
                schema: "identity",
                table: "AspNetUsers",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_Tenants_TenantId",
                schema: "identity",
                table: "AspNetUsers",
                column: "TenantId",
                principalSchema: "identity",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Step 5: Rename roles (Admin -> PlatformAdmin, HR -> HRAdmin)
            migrationBuilder.Sql("""
                UPDATE "identity"."AspNetRoles"
                SET "Name" = 'PlatformAdmin', "NormalizedName" = 'PLATFORMADMIN'
                WHERE "Name" = 'Admin';

                UPDATE "identity"."AspNetRoles"
                SET "Name" = 'HRAdmin', "NormalizedName" = 'HRADMIN'
                WHERE "Name" = 'HR';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert role renames
            migrationBuilder.Sql("""
                UPDATE "identity"."AspNetRoles"
                SET "Name" = 'Admin', "NormalizedName" = 'ADMIN'
                WHERE "Name" = 'PlatformAdmin';

                UPDATE "identity"."AspNetRoles"
                SET "Name" = 'HR', "NormalizedName" = 'HR'
                WHERE "Name" = 'HRAdmin';
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_Tenants_TenantId",
                schema: "identity",
                table: "AspNetUsers");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_TenantId",
                schema: "identity",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "identity",
                table: "AspNetUsers");
        }
    }
}

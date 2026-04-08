using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantPlatformAdminMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InternalNotes",
                schema: "identity",
                table: "Tenants",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsArchived",
                schema: "identity",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PlanTier",
                schema: "identity",
                table: "Tenants",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_IsArchived",
                schema: "identity",
                table: "Tenants",
                column: "IsArchived");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tenants_IsArchived",
                schema: "identity",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "InternalNotes",
                schema: "identity",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "IsArchived",
                schema: "identity",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "PlanTier",
                schema: "identity",
                table: "Tenants");
        }
    }
}

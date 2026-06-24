using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations;

public partial class AddOrganizationalAccessScopes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "UserAccessProfileOrgUnitScopes",
            schema: "identity",
            columns: table => new
            {
                UserId = table.Column<Guid>(type: "uuid", nullable: false),
                AccessProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                OrgUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_UserAccessProfileOrgUnitScopes", x => new { x.UserId, x.AccessProfileId, x.OrgUnitId });
                table.ForeignKey(
                    name: "FK_UserAccessProfileOrgUnitScopes_UserAccessProfiles_UserId_AccessProfileId",
                    columns: x => new { x.UserId, x.AccessProfileId },
                    principalSchema: "identity",
                    principalTable: "UserAccessProfiles",
                    principalColumns: new[] { "UserId", "AccessProfileId" },
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_UserAccessProfileOrgUnitScopes_TenantId",
            schema: "identity",
            table: "UserAccessProfileOrgUnitScopes",
            column: "TenantId");

        migrationBuilder.CreateIndex(
            name: "IX_UserAccessProfileOrgUnitScopes_TenantId_OrgUnitId",
            schema: "identity",
            table: "UserAccessProfileOrgUnitScopes",
            columns: new[] { "TenantId", "OrgUnitId" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropTable(name: "UserAccessProfileOrgUnitScopes", schema: "identity");
}

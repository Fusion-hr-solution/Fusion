using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCoreAccessProfilesPermissionsFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccessProfiles",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(280)", maxLength: 280, nullable: true),
                    Type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    IsSystemProtected = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AccessProfileGrants",
                schema: "identity",
                columns: table => new
                {
                    AccessProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    PermissionKey = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Scope = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessProfileGrants", x => new { x.AccessProfileId, x.PermissionKey });
                    table.ForeignKey(
                        name: "FK_AccessProfileGrants_AccessProfiles_AccessProfileId",
                        column: x => x.AccessProfileId,
                        principalSchema: "identity",
                        principalTable: "AccessProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InviteAccessProfiles",
                schema: "identity",
                columns: table => new
                {
                    InviteTokenId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccessProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InviteAccessProfiles", x => new { x.InviteTokenId, x.AccessProfileId });
                    table.ForeignKey(
                        name: "FK_InviteAccessProfiles_AccessProfiles_AccessProfileId",
                        column: x => x.AccessProfileId,
                        principalSchema: "identity",
                        principalTable: "AccessProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InviteAccessProfiles_InviteTokens_InviteTokenId",
                        column: x => x.InviteTokenId,
                        principalSchema: "identity",
                        principalTable: "InviteTokens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserAccessProfiles",
                schema: "identity",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccessProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserAccessProfiles", x => new { x.UserId, x.AccessProfileId });
                    table.ForeignKey(
                        name: "FK_UserAccessProfiles_AccessProfiles_AccessProfileId",
                        column: x => x.AccessProfileId,
                        principalSchema: "identity",
                        principalTable: "AccessProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserAccessProfiles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "identity",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccessProfileGrants_TenantId",
                schema: "identity",
                table: "AccessProfileGrants",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AccessProfileGrants_TenantId_PermissionKey",
                schema: "identity",
                table: "AccessProfileGrants",
                columns: new[] { "TenantId", "PermissionKey" });

            migrationBuilder.CreateIndex(
                name: "IX_AccessProfiles_TenantId",
                schema: "identity",
                table: "AccessProfiles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AccessProfiles_TenantId_NormalizedName",
                schema: "identity",
                table: "AccessProfiles",
                columns: new[] { "TenantId", "NormalizedName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InviteAccessProfiles_AccessProfileId",
                schema: "identity",
                table: "InviteAccessProfiles",
                column: "AccessProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_InviteAccessProfiles_TenantId",
                schema: "identity",
                table: "InviteAccessProfiles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_UserAccessProfiles_AccessProfileId",
                schema: "identity",
                table: "UserAccessProfiles",
                column: "AccessProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_UserAccessProfiles_TenantId",
                schema: "identity",
                table: "UserAccessProfiles",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccessProfileGrants",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "InviteAccessProfiles",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "UserAccessProfiles",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "AccessProfiles",
                schema: "identity");
        }
    }
}

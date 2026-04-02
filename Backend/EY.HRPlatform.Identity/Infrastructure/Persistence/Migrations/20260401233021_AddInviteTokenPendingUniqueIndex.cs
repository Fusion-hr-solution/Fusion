using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInviteTokenPendingUniqueIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_Email",
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_Email_Pending",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId_Email",
                schema: "identity",
                table: "InviteTokens",
                columns: new[] { "TenantId", "Email" });
        }
    }
}

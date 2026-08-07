using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAdministrativeInvitationPurposes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId",
                schema: "identity",
                table: "InviteTokens",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId_Email_AdministrativePending",
                schema: "identity",
                table: "InviteTokens",
                columns: new[] { "TenantId", "Email" },
                unique: true,
                filter: "\"Purpose\" IN ('TenantAdministrator', 'TenantAdministratorRecovery') AND \"AcceptedAt\" IS NULL AND \"IsRevoked\" = false AND \"SupersededAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId_EmployeeId",
                schema: "identity",
                table: "InviteTokens",
                columns: new[] { "TenantId", "EmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_InviteTokens_TenantId_RecoveryPending",
                schema: "identity",
                table: "InviteTokens",
                column: "TenantId",
                unique: true,
                filter: "\"Purpose\" = 'TenantAdministratorRecovery' AND \"AcceptedAt\" IS NULL AND \"IsRevoked\" = false AND \"SupersededAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_Email_AdministrativePending",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_EmployeeId",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropIndex(
                name: "IX_InviteTokens_TenantId_RecoveryPending",
                schema: "identity",
                table: "InviteTokens");
        }
    }
}

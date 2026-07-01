using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CapturePendingModelChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS identity.\"IX_InviteTokens_TenantId_EmployeeId\";");

            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_InviteTokens_TenantId_EmployeeId_Pending\" "
                + "ON identity.\"InviteTokens\" (\"TenantId\", \"EmployeeId\") "
                + "WHERE \"EmployeeId\" IS NOT NULL AND \"AcceptedAt\" IS NULL AND \"IsRevoked\" = false;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS identity.\"IX_InviteTokens_TenantId_EmployeeId_Pending\";");

            migrationBuilder.Sql(
                "CREATE INDEX IF NOT EXISTS \"IX_InviteTokens_TenantId_EmployeeId\" "
                + "ON identity.\"InviteTokens\" (\"TenantId\", \"EmployeeId\");");
        }
    }
}

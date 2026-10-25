using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PerformanceNotificationPreferences",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    RecipientUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    EmailOff = table.Column<List<string>>(type: "text[]", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceNotificationPreferences", x => x.Id);
                    table.CheckConstraint("CK_PerformanceNotificationPreferences_Recipient", "(\"RecipientEmployeeId\" IS NULL) <> (\"RecipientUserId\" IS NULL)");
                });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceNotificationPreferences_TenantId_RecipientEmploy~",
                schema: "performance",
                table: "PerformanceNotificationPreferences",
                columns: new[] { "TenantId", "RecipientEmployeeId" },
                unique: true,
                filter: "\"RecipientEmployeeId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceNotificationPreferences_TenantId_RecipientUserId",
                schema: "performance",
                table: "PerformanceNotificationPreferences",
                columns: new[] { "TenantId", "RecipientUserId" },
                unique: true,
                filter: "\"RecipientUserId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PerformanceNotificationPreferences",
                schema: "performance");
        }
    }
}

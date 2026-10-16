using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInAppNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PerformanceNotifications",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    RecipientUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Kind = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ResourceType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ResourceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Context = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ActorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Href = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DedupeKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceNotifications", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceNotifications_OccurredAt",
                schema: "performance",
                table: "PerformanceNotifications",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceNotifications_TenantId_DedupeKey",
                schema: "performance",
                table: "PerformanceNotifications",
                columns: new[] { "TenantId", "DedupeKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceNotifications_TenantId_RecipientEmployeeId_Occur~",
                schema: "performance",
                table: "PerformanceNotifications",
                columns: new[] { "TenantId", "RecipientEmployeeId", "OccurredAt" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceNotifications_TenantId_RecipientUserId_OccurredAt",
                schema: "performance",
                table: "PerformanceNotifications",
                columns: new[] { "TenantId", "RecipientUserId", "OccurredAt" },
                descending: new[] { false, false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PerformanceNotifications",
                schema: "performance");
        }
    }
}

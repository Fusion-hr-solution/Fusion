using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCoreNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CoreNotificationPreferences",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmailOff = table.Column<List<string>>(type: "text[]", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoreNotificationPreferences", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CoreNotifications",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ChangeId = table.Column<Guid>(type: "uuid", nullable: false),
                    TitleKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ContextKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ValuesJson = table.Column<string>(type: "jsonb", nullable: false),
                    ActorName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ActorEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    Href = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DedupeKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    EmailAttempts = table.Column<int>(type: "integer", nullable: false),
                    EmailNextAttemptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EmailSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EmailSkippedReason = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    EmailLastError = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoreNotifications", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CoreNotificationPreferences_TenantId_Recipient",
                schema: "corehr",
                table: "CoreNotificationPreferences",
                columns: new[] { "TenantId", "RecipientEmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CoreNotifications_EmailPending",
                schema: "corehr",
                table: "CoreNotifications",
                column: "EmailNextAttemptAt",
                filter: "\"EmailSentAt\" IS NULL AND \"EmailSkippedReason\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CoreNotifications_Recipient_OccurredAt",
                schema: "corehr",
                table: "CoreNotifications",
                columns: new[] { "TenantId", "RecipientEmployeeId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CoreNotifications_TenantId_DedupeKey",
                schema: "corehr",
                table: "CoreNotifications",
                columns: new[] { "TenantId", "DedupeKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CoreNotificationPreferences",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "CoreNotifications",
                schema: "corehr");
        }
    }
}

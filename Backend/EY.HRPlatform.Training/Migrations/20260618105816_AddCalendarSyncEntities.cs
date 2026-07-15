using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddCalendarSyncEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MeetingUrl",
                schema: "training",
                table: "TrainingSessions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CalendarSyncOutboxes",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    NextAttemptUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "text", nullable: true),
                    LockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LockedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarSyncOutboxes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExternalCalendarSyncs",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ICalUid = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Sequence = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Provider = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    LastError = table.Column<string>(type: "text", nullable: true),
                    GraphEventId = table.Column<string>(type: "text", nullable: true),
                    ChangeKey = table.Column<string>(type: "text", nullable: true),
                    TeamsJoinUrl = table.Column<string>(type: "text", nullable: true),
                    OutlookWebLink = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExternalCalendarSyncs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SessionInviteDeliveries",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeEmail = table.Column<string>(type: "text", nullable: true),
                    EmployeeName = table.Column<string>(type: "text", nullable: true),
                    LastSentSequence = table.Column<int>(type: "integer", nullable: false),
                    LastSentMethod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SentAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SessionInviteDeliveries", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarSyncOutboxes_ProcessedAt_NextAttemptUtc",
                schema: "training",
                table: "CalendarSyncOutboxes",
                columns: new[] { "ProcessedAt", "NextAttemptUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ExternalCalendarSyncs_SessionId",
                schema: "training",
                table: "ExternalCalendarSyncs",
                column: "SessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SessionInviteDeliveries_SessionId_EmployeeId",
                schema: "training",
                table: "SessionInviteDeliveries",
                columns: new[] { "SessionId", "EmployeeId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CalendarSyncOutboxes",
                schema: "training");

            migrationBuilder.DropTable(
                name: "ExternalCalendarSyncs",
                schema: "training");

            migrationBuilder.DropTable(
                name: "SessionInviteDeliveries",
                schema: "training");

            migrationBuilder.DropColumn(
                name: "MeetingUrl",
                schema: "training",
                table: "TrainingSessions");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateRetention : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidateRetentionSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    RetentionAction = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false, defaultValue: "Anonymize"),
                    RetentionPeriodDays = table.Column<int>(type: "integer", nullable: false, defaultValue: 90),
                    ScanIntervalHours = table.Column<int>(type: "integer", nullable: false, defaultValue: 24),
                    LastRunAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateRetentionSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CandidateRetentionRuns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TriggeredBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TriggerSource = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    RetentionAction = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    RetentionPeriodDays = table.Column<int>(type: "integer", nullable: false),
                    CandidatesScanned = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CandidatesProcessed = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CandidatesAnonymized = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CandidatesDeleted = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CandidatesExpired = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateRetentionRuns", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidateRetentionRuns_StartedAtUtc",
                table: "CandidateRetentionRuns",
                column: "StartedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateRetentionRuns_TriggerSource",
                table: "CandidateRetentionRuns",
                column: "TriggerSource");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "CandidateRetentionRuns");
            migrationBuilder.DropTable(name: "CandidateRetentionSettings");
        }
    }
}

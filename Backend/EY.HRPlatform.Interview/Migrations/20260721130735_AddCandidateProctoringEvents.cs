using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateProctoringEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastProctorHeartbeatUtc",
                table: "CandidateTestAttempts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CandidateProctoringEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Confidence = table.Column<double>(type: "double precision", nullable: true),
                    Detail = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ServerReceivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClientEventId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateProctoringEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateProctoringEvents_CandidateTestAttempts_AttemptId",
                        column: x => x.AttemptId,
                        principalTable: "CandidateTestAttempts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidateProctoringEvents_AttemptId",
                table: "CandidateProctoringEvents",
                column: "AttemptId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateProctoringEvents_AttemptId_ClientEventId",
                table: "CandidateProctoringEvents",
                columns: new[] { "AttemptId", "ClientEventId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidateProctoringEvents");

            migrationBuilder.DropColumn(
                name: "LastProctorHeartbeatUtc",
                table: "CandidateTestAttempts");
        }
    }
}

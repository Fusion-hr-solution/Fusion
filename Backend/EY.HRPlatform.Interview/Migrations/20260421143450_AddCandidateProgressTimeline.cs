using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateProgressTimeline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CandidateTestAttempts_InvitationId",
                table: "CandidateTestAttempts");

            migrationBuilder.AddColumn<int>(
                name: "AttemptNumber",
                table: "CandidateTestAttempts",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateTable(
                name: "CandidateProgressEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvitationId = table.Column<Guid>(type: "uuid", nullable: false),
                    TestId = table.Column<Guid>(type: "uuid", nullable: false),
                    CandidateEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    CandidateName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: true),
                    AttemptNumber = table.Column<int>(type: "integer", nullable: false),
                    Milestone = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OccurredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClientIpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    BrowserFingerprintHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateProgressEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateProgressEvents_CandidateInvitations_InvitationId",
                        column: x => x.InvitationId,
                        principalTable: "CandidateInvitations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CandidateProgressEvents_CandidateTestAttempts_AttemptId",
                        column: x => x.AttemptId,
                        principalTable: "CandidateTestAttempts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CandidateProgressEvents_Tests_TestId",
                        column: x => x.TestId,
                        principalTable: "Tests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidateTestAttempts_InvitationId",
                table: "CandidateTestAttempts",
                column: "InvitationId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateTestAttempts_InvitationId_AttemptNumber",
                table: "CandidateTestAttempts",
                columns: new[] { "InvitationId", "AttemptNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidateProgressEvents_AttemptId",
                table: "CandidateProgressEvents",
                column: "AttemptId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateProgressEvents_InvitationId",
                table: "CandidateProgressEvents",
                column: "InvitationId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateProgressEvents_InvitationId_AttemptNumber_Occurred~",
                table: "CandidateProgressEvents",
                columns: new[] { "InvitationId", "AttemptNumber", "OccurredAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidateProgressEvents_Milestone_OccurredAtUtc",
                table: "CandidateProgressEvents",
                columns: new[] { "Milestone", "OccurredAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CandidateProgressEvents_TestId",
                table: "CandidateProgressEvents",
                column: "TestId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidateProgressEvents");

            migrationBuilder.DropIndex(
                name: "IX_CandidateTestAttempts_InvitationId",
                table: "CandidateTestAttempts");

            migrationBuilder.DropIndex(
                name: "IX_CandidateTestAttempts_InvitationId_AttemptNumber",
                table: "CandidateTestAttempts");

            migrationBuilder.DropColumn(
                name: "AttemptNumber",
                table: "CandidateTestAttempts");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateTestAttempts_InvitationId",
                table: "CandidateTestAttempts",
                column: "InvitationId",
                unique: true);
        }
    }
}

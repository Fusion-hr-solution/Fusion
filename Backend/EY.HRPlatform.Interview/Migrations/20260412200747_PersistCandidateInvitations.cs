using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    /// <inheritdoc />
    public partial class PersistCandidateInvitations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidateInvitations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TestId = table.Column<Guid>(type: "uuid", nullable: false),
                    TestTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    CandidateName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    DeadlineUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    InviteMethod = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false, defaultValue: "email"),
                    TimeLimitMinutes = table.Column<int>(type: "integer", nullable: true),
                    CustomMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    InviteLink = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    LastSentAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResendCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    OpensCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateInvitations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateInvitations_Tests_TestId",
                        column: x => x.TestId,
                        principalTable: "Tests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidateInvitations_CreatedAt",
                table: "CandidateInvitations",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateInvitations_Email",
                table: "CandidateInvitations",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateInvitations_Status",
                table: "CandidateInvitations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateInvitations_TestId",
                table: "CandidateInvitations",
                column: "TestId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidateInvitations");
        }
    }
}

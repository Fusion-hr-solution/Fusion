using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    /// <inheritdoc />
    public partial class SecureCandidateAccessLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AttemptStartedAtUtc",
                table: "CandidateInvitations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AttemptSubmittedAtUtc",
                table: "CandidateInvitations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LinkExpiryHours",
                table: "CandidateInvitations",
                type: "integer",
                nullable: false,
                defaultValue: 72);

            migrationBuilder.AddColumn<DateTime>(
                name: "TokenCreatedAtUtc",
                table: "CandidateInvitations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TokenExpiresAtUtc",
                table: "CandidateInvitations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TokenHash",
                table: "CandidateInvitations",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE "CandidateInvitations"
                SET
                    "TokenHash" = UPPER(md5(COALESCE(NULLIF(substring("InviteLink" from 'token=([^&]+)'), ''), "Id"::text))),
                    "TokenCreatedAtUtc" = COALESCE("LastSentAtUtc", "CreatedAt", CURRENT_TIMESTAMP),
                    "TokenExpiresAtUtc" = COALESCE("LastSentAtUtc", "CreatedAt", CURRENT_TIMESTAMP) + make_interval(hours => "LinkExpiryHours")
                """);

            migrationBuilder.AlterColumn<DateTime>(
                name: "TokenCreatedAtUtc",
                table: "CandidateInvitations",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "TokenExpiresAtUtc",
                table: "CandidateInvitations",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "TokenHash",
                table: "CandidateInvitations",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128,
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "CandidateTestAttempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvitationId = table.Column<Guid>(type: "uuid", nullable: false),
                    TestId = table.Column<Guid>(type: "uuid", nullable: false),
                    CandidateEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    CandidateName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SubmittedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AnswersJson = table.Column<string>(type: "text", nullable: false),
                    ResultJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateTestAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateTestAttempts_CandidateInvitations_InvitationId",
                        column: x => x.InvitationId,
                        principalTable: "CandidateInvitations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CandidateTestAttempts_Tests_TestId",
                        column: x => x.TestId,
                        principalTable: "Tests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidateInvitations_TokenExpiresAtUtc",
                table: "CandidateInvitations",
                column: "TokenExpiresAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateInvitations_TokenHash",
                table: "CandidateInvitations",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidateTestAttempts_CandidateEmail",
                table: "CandidateTestAttempts",
                column: "CandidateEmail");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateTestAttempts_InvitationId",
                table: "CandidateTestAttempts",
                column: "InvitationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidateTestAttempts_SubmittedAtUtc",
                table: "CandidateTestAttempts",
                column: "SubmittedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateTestAttempts_TestId",
                table: "CandidateTestAttempts",
                column: "TestId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidateTestAttempts");

            migrationBuilder.DropIndex(
                name: "IX_CandidateInvitations_TokenExpiresAtUtc",
                table: "CandidateInvitations");

            migrationBuilder.DropIndex(
                name: "IX_CandidateInvitations_TokenHash",
                table: "CandidateInvitations");

            migrationBuilder.DropColumn(
                name: "AttemptStartedAtUtc",
                table: "CandidateInvitations");

            migrationBuilder.DropColumn(
                name: "AttemptSubmittedAtUtc",
                table: "CandidateInvitations");

            migrationBuilder.DropColumn(
                name: "LinkExpiryHours",
                table: "CandidateInvitations");

            migrationBuilder.DropColumn(
                name: "TokenCreatedAtUtc",
                table: "CandidateInvitations");

            migrationBuilder.DropColumn(
                name: "TokenExpiresAtUtc",
                table: "CandidateInvitations");

            migrationBuilder.DropColumn(
                name: "TokenHash",
                table: "CandidateInvitations");
        }
    }
}

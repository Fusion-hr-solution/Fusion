using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidatePrivacyActions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidatePrivacyActions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TestId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvitationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActionType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    TriggerSource = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    AdminId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CandidateEmailHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CandidateAliasEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    CandidateAliasName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    InvitationsUpdated = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    AttemptsUpdated = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    EventsUpdated = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidatePrivacyActions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidatePrivacyActions_CandidateEmailHash",
                table: "CandidatePrivacyActions",
                column: "CandidateEmailHash");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatePrivacyActions_InvitationId",
                table: "CandidatePrivacyActions",
                column: "InvitationId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidatePrivacyActions_TestId",
                table: "CandidatePrivacyActions",
                column: "TestId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidatePrivacyActions");
        }
    }
}

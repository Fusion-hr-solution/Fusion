using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateLinkSecuritySettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CandidateLinkSecuritySettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TestId = table.Column<Guid>(type: "uuid", nullable: false),
                    SingleUseLinkEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    EmailVerificationEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    IpLockEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    BrowserFingerprintEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    LinkValidForValue = table.Column<int>(type: "integer", nullable: false, defaultValue: 7),
                    LinkValidForUnit = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false, defaultValue: "days"),
                    GracePeriodValue = table.Column<int>(type: "integer", nullable: false, defaultValue: 30),
                    GracePeriodUnit = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false, defaultValue: "minutes"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateLinkSecuritySettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateLinkSecuritySettings_Tests_TestId",
                        column: x => x.TestId,
                        principalTable: "Tests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CandidateLinkSecuritySettings_TestId",
                table: "CandidateLinkSecuritySettings",
                column: "TestId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CandidateLinkSecuritySettings");
        }
    }
}

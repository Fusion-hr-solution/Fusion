using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Interview.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateAccessRuntimeLocks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccessFingerprintHash",
                table: "CandidateInvitations",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EmailVerifiedAtUtc",
                table: "CandidateInvitations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LockedIpAddress",
                table: "CandidateInvitations",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VerifiedEmail",
                table: "CandidateInvitations",
                type: "character varying(320)",
                maxLength: 320,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccessFingerprintHash",
                table: "CandidateInvitations");

            migrationBuilder.DropColumn(
                name: "EmailVerifiedAtUtc",
                table: "CandidateInvitations");

            migrationBuilder.DropColumn(
                name: "LockedIpAddress",
                table: "CandidateInvitations");

            migrationBuilder.DropColumn(
                name: "VerifiedEmail",
                table: "CandidateInvitations");
        }
    }
}

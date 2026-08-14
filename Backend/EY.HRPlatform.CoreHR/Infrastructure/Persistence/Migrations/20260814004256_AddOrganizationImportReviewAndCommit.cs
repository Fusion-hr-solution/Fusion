using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationImportReviewAndCommit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CommitResultJson",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CommittedAt",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CommittedByDisplayName",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CommittedByUserId",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DecisionRevision",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "DecisionsJson",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{}'::jsonb");

            migrationBuilder.AddColumn<DateTime>(
                name: "DecisionsUpdatedAt",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DecisionsUpdatedByDisplayName",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DecisionsUpdatedByUserId",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinalProvenanceJson",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinalSemanticDigest",
                schema: "corehr",
                table: "OrganizationImportSessions",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CommitResultJson",
                schema: "corehr",
                table: "OrganizationImportSessions");

            migrationBuilder.DropColumn(
                name: "CommittedAt",
                schema: "corehr",
                table: "OrganizationImportSessions");

            migrationBuilder.DropColumn(
                name: "CommittedByDisplayName",
                schema: "corehr",
                table: "OrganizationImportSessions");

            migrationBuilder.DropColumn(
                name: "CommittedByUserId",
                schema: "corehr",
                table: "OrganizationImportSessions");

            migrationBuilder.DropColumn(
                name: "DecisionRevision",
                schema: "corehr",
                table: "OrganizationImportSessions");

            migrationBuilder.DropColumn(
                name: "DecisionsJson",
                schema: "corehr",
                table: "OrganizationImportSessions");

            migrationBuilder.DropColumn(
                name: "DecisionsUpdatedAt",
                schema: "corehr",
                table: "OrganizationImportSessions");

            migrationBuilder.DropColumn(
                name: "DecisionsUpdatedByDisplayName",
                schema: "corehr",
                table: "OrganizationImportSessions");

            migrationBuilder.DropColumn(
                name: "DecisionsUpdatedByUserId",
                schema: "corehr",
                table: "OrganizationImportSessions");

            migrationBuilder.DropColumn(
                name: "FinalProvenanceJson",
                schema: "corehr",
                table: "OrganizationImportSessions");

            migrationBuilder.DropColumn(
                name: "FinalSemanticDigest",
                schema: "corehr",
                table: "OrganizationImportSessions");
        }
    }
}

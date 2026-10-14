using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CaptureReviewLaunchSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReviewerBasis",
                schema: "performance",
                table: "PerformanceReviews",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SubjectJobTitle",
                schema: "performance",
                table: "PerformanceReviews",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SubjectOrgUnitId",
                schema: "performance",
                table: "PerformanceReviews",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubjectOrgUnitName",
                schema: "performance",
                table: "PerformanceReviews",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE performance."PerformanceReviews" AS review
                SET "ReviewerBasis" = round_subject."ReviewerBasis",
                    "SubjectJobTitle" = participant."JobTitle",
                    "SubjectOrgUnitId" = participant."OrgUnitId",
                    "SubjectOrgUnitName" = participant."OrgUnitName"
                FROM performance."ReviewRoundSubjects" AS round_subject
                JOIN performance."Participants" AS participant
                  ON participant."Id" = round_subject."ParticipantId"
                 AND participant."TenantId" = round_subject."TenantId"
                WHERE round_subject."TenantId" = review."TenantId"
                  AND round_subject."ReviewRoundId" = review."ReviewRoundId"
                  AND round_subject."SubjectEmployeeId" = review."SubjectEmployeeId";
                """);

            migrationBuilder.AlterColumn<string>(
                name: "ReviewerBasis",
                schema: "performance",
                table: "PerformanceReviews",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40,
                oldDefaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReviewerBasis",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SubjectJobTitle",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SubjectOrgUnitId",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SubjectOrgUnitName",
                schema: "performance",
                table: "PerformanceReviews");
        }
    }
}

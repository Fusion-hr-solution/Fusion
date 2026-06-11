using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddNamedCertification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Certifications_Trainings_TrainingId",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropIndex(
                name: "IX_Certifications_EmployeeId_TrainingId",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "CertificateUri",
                schema: "training",
                table: "Certifications");

            migrationBuilder.AddColumn<bool>(
                name: "IssuesCertificate",
                schema: "training",
                table: "Trainings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            // Idempotent: a parallel branch's migration (AddEmployeeProfileTenantAndName) may have
            // already added these columns to a shared dev database. IF NOT EXISTS skips them there
            // while still creating them on a clean (develop/CI) database.
            migrationBuilder.Sql(
                "ALTER TABLE training.\"EmployeeProfiles\" ADD COLUMN IF NOT EXISTS \"Email\" character varying(320);");
            migrationBuilder.Sql(
                "ALTER TABLE training.\"EmployeeProfiles\" ADD COLUMN IF NOT EXISTS \"FullName\" character varying(256);");

            migrationBuilder.AddColumn<string>(
                name: "CertificateNumber",
                schema: "training",
                table: "Certifications",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                schema: "training",
                table: "Certifications",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "Credits",
                schema: "training",
                table: "Certifications",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Duration",
                schema: "training",
                table: "Certifications",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmployeeFullName",
                schema: "training",
                table: "Certifications",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "GradeId",
                schema: "training",
                table: "Certifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GradeName",
                schema: "training",
                table: "Certifications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "PdfContent",
                schema: "training",
                table: "Certifications",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PdfContentType",
                schema: "training",
                table: "Certifications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PdfGeneratedAt",
                schema: "training",
                table: "Certifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RevokedAt",
                schema: "training",
                table: "Certifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RevokedBy",
                schema: "training",
                table: "Certifications",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RevokedReason",
                schema: "training",
                table: "Certifications",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ServiceLineId",
                schema: "training",
                table: "Certifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ServiceLineName",
                schema: "training",
                table: "Certifications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                schema: "training",
                table: "Certifications",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TrainerName",
                schema: "training",
                table: "Certifications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrainingDescription",
                schema: "training",
                table: "Certifications",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrainingTitle",
                schema: "training",
                table: "Certifications",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Certifications_CertificateNumber",
                schema: "training",
                table: "Certifications",
                column: "CertificateNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Certifications_EmployeeId_TrainingId",
                schema: "training",
                table: "Certifications",
                columns: new[] { "EmployeeId", "TrainingId" },
                unique: true,
                filter: "\"Status\" = 'Valid'");

            migrationBuilder.CreateIndex(
                name: "IX_Certifications_IssuedAt",
                schema: "training",
                table: "Certifications",
                column: "IssuedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Certifications_Status",
                schema: "training",
                table: "Certifications",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Certifications_CertificateNumber",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropIndex(
                name: "IX_Certifications_EmployeeId_TrainingId",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropIndex(
                name: "IX_Certifications_IssuedAt",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropIndex(
                name: "IX_Certifications_Status",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "IssuesCertificate",
                schema: "training",
                table: "Trainings");

            migrationBuilder.Sql("ALTER TABLE training.\"EmployeeProfiles\" DROP COLUMN IF EXISTS \"Email\";");
            migrationBuilder.Sql("ALTER TABLE training.\"EmployeeProfiles\" DROP COLUMN IF EXISTS \"FullName\";");

            migrationBuilder.DropColumn(
                name: "CertificateNumber",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "Credits",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "Duration",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "EmployeeFullName",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "GradeId",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "GradeName",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "PdfContent",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "PdfContentType",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "PdfGeneratedAt",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "RevokedAt",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "RevokedBy",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "RevokedReason",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "ServiceLineId",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "ServiceLineName",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "Status",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "TrainerName",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "TrainingDescription",
                schema: "training",
                table: "Certifications");

            migrationBuilder.DropColumn(
                name: "TrainingTitle",
                schema: "training",
                table: "Certifications");

            migrationBuilder.AddColumn<string>(
                name: "CertificateUri",
                schema: "training",
                table: "Certifications",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Certifications_EmployeeId_TrainingId",
                schema: "training",
                table: "Certifications",
                columns: new[] { "EmployeeId", "TrainingId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Certifications_Trainings_TrainingId",
                schema: "training",
                table: "Certifications",
                column: "TrainingId",
                principalSchema: "training",
                principalTable: "Trainings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

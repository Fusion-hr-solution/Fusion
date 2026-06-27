using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeImportBatchSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing import sessions are short-lived (2h expiry); back-fill transient rows with a
            // safe runtime default. New sessions always set these from the upload request.
            migrationBuilder.AddColumn<DateTime>(
                name: "BatchEffectiveDate",
                schema: "corehr",
                table: "EmployeeImportSessions",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<string>(
                name: "ImportMode",
                schema: "corehr",
                table: "EmployeeImportSessions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "BusinessChange");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BatchEffectiveDate",
                schema: "corehr",
                table: "EmployeeImportSessions");

            migrationBuilder.DropColumn(
                name: "ImportMode",
                schema: "corehr",
                table: "EmployeeImportSessions");
        }
    }
}

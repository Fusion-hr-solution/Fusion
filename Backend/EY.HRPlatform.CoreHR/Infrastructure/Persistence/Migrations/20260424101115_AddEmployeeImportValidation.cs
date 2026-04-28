using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeImportValidation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NormalizedRowsJson",
                schema: "corehr",
                table: "EmployeeImportSessions",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ValidationIssuesJson",
                schema: "corehr",
                table: "EmployeeImportSessions",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NormalizedRowsJson",
                schema: "corehr",
                table: "EmployeeImportSessions");

            migrationBuilder.DropColumn(
                name: "ValidationIssuesJson",
                schema: "corehr",
                table: "EmployeeImportSessions");
        }
    }
}

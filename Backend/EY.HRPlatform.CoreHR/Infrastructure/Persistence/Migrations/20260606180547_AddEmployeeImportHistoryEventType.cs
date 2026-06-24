using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeImportHistoryEventType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ErrorCount",
                schema: "corehr",
                table: "EmployeeImportHistories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "EventType",
                schema: "corehr",
                table: "EmployeeImportHistories",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "WarningCount",
                schema: "corehr",
                table: "EmployeeImportHistories",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ErrorCount",
                schema: "corehr",
                table: "EmployeeImportHistories");

            migrationBuilder.DropColumn(
                name: "EventType",
                schema: "corehr",
                table: "EmployeeImportHistories");

            migrationBuilder.DropColumn(
                name: "WarningCount",
                schema: "corehr",
                table: "EmployeeImportHistories");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeInfoToSessionEnrollment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EmployeeEmail",
                schema: "training",
                table: "SessionEnrollments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmployeeName",
                schema: "training",
                table: "SessionEnrollments",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmployeeEmail",
                schema: "training",
                table: "SessionEnrollments");

            migrationBuilder.DropColumn(
                name: "EmployeeName",
                schema: "training",
                table: "SessionEnrollments");
        }
    }
}

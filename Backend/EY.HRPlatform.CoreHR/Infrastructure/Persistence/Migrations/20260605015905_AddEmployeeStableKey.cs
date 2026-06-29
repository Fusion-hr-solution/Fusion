using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeStableKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StableEmployeeKey",
                schema: "corehr",
                table: "Employees",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE corehr."Employees"
                SET "StableEmployeeKey" = 'E-' || UPPER(SUBSTRING(REPLACE("Id"::text, '-', '') FROM 1 FOR 8))
                WHERE "StableEmployeeKey" IS NULL OR "StableEmployeeKey" = '';
                """);

            migrationBuilder.AlterColumn<string>(
                name: "StableEmployeeKey",
                schema: "corehr",
                table: "Employees",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_TenantId_StableEmployeeKey",
                schema: "corehr",
                table: "Employees",
                columns: new[] { "TenantId", "StableEmployeeKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Employees_TenantId_StableEmployeeKey",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "StableEmployeeKey",
                schema: "corehr",
                table: "Employees");
        }
    }
}

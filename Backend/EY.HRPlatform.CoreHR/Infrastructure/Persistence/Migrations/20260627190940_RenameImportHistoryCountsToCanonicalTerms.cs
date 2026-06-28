using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameImportHistoryCountsToCanonicalTerms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ValidRowCount",
                schema: "corehr",
                table: "EmployeeImportHistories",
                newName: "ValidatedRowCount");

            migrationBuilder.RenameColumn(
                name: "SkippedCount",
                schema: "corehr",
                table: "EmployeeImportHistories",
                newName: "UnchangedRowCount");

            migrationBuilder.AddColumn<int>(
                name: "PublishedRowCount",
                schema: "corehr",
                table: "EmployeeImportHistories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Pre-existing publications only ever created employees (no controlled-update path
            // existed), so the count of rows whose canonical changes were committed equals
            // CreatedCount for historical rows. Backfill accordingly.
            migrationBuilder.Sql(
                "UPDATE corehr.\"EmployeeImportHistories\" SET \"PublishedRowCount\" = \"CreatedCount\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PublishedRowCount",
                schema: "corehr",
                table: "EmployeeImportHistories");

            migrationBuilder.RenameColumn(
                name: "ValidatedRowCount",
                schema: "corehr",
                table: "EmployeeImportHistories",
                newName: "ValidRowCount");

            migrationBuilder.RenameColumn(
                name: "UnchangedRowCount",
                schema: "corehr",
                table: "EmployeeImportHistories",
                newName: "SkippedCount");
        }
    }
}

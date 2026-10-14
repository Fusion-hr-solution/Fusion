using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RecordCycleClosure : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EarlyCloseReason",
                schema: "performance",
                table: "PerformanceCycles",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClosureExceptionReason",
                schema: "performance",
                table: "Participants",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EarlyCloseReason",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "ClosureExceptionReason",
                schema: "performance",
                table: "Participants");
        }
    }
}

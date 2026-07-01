using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditEventOutcomeAndCorrelationId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CorrelationId",
                schema: "performance",
                table: "PerformanceCycleAuditEvents",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Outcome",
                schema: "performance",
                table: "PerformanceCycleAuditEvents",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CorrelationId",
                schema: "performance",
                table: "PerformanceCycleAuditEvents");

            migrationBuilder.DropColumn(
                name: "Outcome",
                schema: "performance",
                table: "PerformanceCycleAuditEvents");
        }
    }
}

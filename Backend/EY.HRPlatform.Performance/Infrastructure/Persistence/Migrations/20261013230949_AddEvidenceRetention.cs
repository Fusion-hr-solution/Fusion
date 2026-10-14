using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEvidenceRetention : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsRemovedUnderRetention",
                schema: "performance",
                table: "EvidenceItems",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "EvidenceRetentionMonths",
                schema: "performance",
                table: "CycleSettings",
                type: "integer",
                nullable: false,
                defaultValue: 36);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsRemovedUnderRetention",
                schema: "performance",
                table: "EvidenceItems");

            migrationBuilder.DropColumn(
                name: "EvidenceRetentionMonths",
                schema: "performance",
                table: "CycleSettings");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceStandaloneToggleWithPlanAlignmentPolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "PlanAlignmentPolicy", schema: "performance", table: "CycleSettings", type: "character varying(40)", maxLength: 40, nullable: false, defaultValue: "AtLeastOneConnected");
            migrationBuilder.Sql("""
                UPDATE performance."CycleSettings"
                SET "PlanAlignmentPolicy" = CASE WHEN "AllowStandaloneObjectives" THEN 'AtLeastOneConnected' ELSE 'EveryObjectiveConnected' END;
                """);
            migrationBuilder.DropColumn(name: "AllowStandaloneObjectives", schema: "performance", table: "CycleSettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(name: "AllowStandaloneObjectives", schema: "performance", table: "CycleSettings", type: "boolean", nullable: false, defaultValue: true);
            migrationBuilder.Sql("""
                UPDATE performance."CycleSettings"
                SET "AllowStandaloneObjectives" = "PlanAlignmentPolicy" <> 'EveryObjectiveConnected';
                """);
            migrationBuilder.DropColumn(name: "PlanAlignmentPolicy", schema: "performance", table: "CycleSettings");
        }
    }
}

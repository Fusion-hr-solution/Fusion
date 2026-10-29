using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NotificationTextKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Title",
                schema: "performance",
                table: "PerformanceNotifications",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300);

            migrationBuilder.AddColumn<string>(
                name: "ContextKey",
                schema: "performance",
                table: "PerformanceNotifications",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TitleKey",
                schema: "performance",
                table: "PerformanceNotifications",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Values",
                schema: "performance",
                table: "PerformanceNotifications",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Rows written as keys have no English title; keep the key so the column can be required again.
            migrationBuilder.Sql("""UPDATE performance."PerformanceNotifications" SET "Title" = COALESCE("TitleKey", '') WHERE "Title" IS NULL""");

            migrationBuilder.DropColumn(
                name: "ContextKey",
                schema: "performance",
                table: "PerformanceNotifications");

            migrationBuilder.DropColumn(
                name: "TitleKey",
                schema: "performance",
                table: "PerformanceNotifications");

            migrationBuilder.DropColumn(
                name: "Values",
                schema: "performance",
                table: "PerformanceNotifications");

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                schema: "performance",
                table: "PerformanceNotifications",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(300)",
                oldMaxLength: 300,
                oldNullable: true);
        }
    }
}

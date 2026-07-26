using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationSubjectAndRoute : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NavigationRoute",
                schema: "performance",
                table: "PerformanceNotifications",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SubjectId",
                schema: "performance",
                table: "PerformanceNotifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubjectType",
                schema: "performance",
                table: "PerformanceNotifications",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NavigationRoute",
                schema: "performance",
                table: "PerformanceNotifications");

            migrationBuilder.DropColumn(
                name: "SubjectId",
                schema: "performance",
                table: "PerformanceNotifications");

            migrationBuilder.DropColumn(
                name: "SubjectType",
                schema: "performance",
                table: "PerformanceNotifications");
        }
    }
}

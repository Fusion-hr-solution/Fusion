using Microsoft.EntityFrameworkCore.Migrations;

using System;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInviteDeliveryTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeliveryMessage",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeliveryRecordedAt",
                schema: "identity",
                table: "InviteTokens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryStatus",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeliveryMessage",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "DeliveryRecordedAt",
                schema: "identity",
                table: "InviteTokens");

            migrationBuilder.DropColumn(
                name: "DeliveryStatus",
                schema: "identity",
                table: "InviteTokens");
        }
    }
}

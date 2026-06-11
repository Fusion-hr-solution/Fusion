using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAccessProfileInternalKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeliveryMessage",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(512)",
                maxLength: 512,
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
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InternalKey",
                schema: "identity",
                table: "AccessProfiles",
                type: "text",
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

            migrationBuilder.DropColumn(
                name: "InternalKey",
                schema: "identity",
                table: "AccessProfiles");
        }
    }
}

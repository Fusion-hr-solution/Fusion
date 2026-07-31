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
            // NOTE: DeliveryMessage/DeliveryRecordedAt/DeliveryStatus were already created by
            // 20260514011839_AddInviteDeliveryTracking. This migration was generated against a
            // stale snapshot and re-emitted them as AddColumn (a merge/rebase artifact), which
            // collides with the existing columns. Its real intent is: resize DeliveryMessage
            // (500->512) and DeliveryStatus (50->32) to match the current model, and add
            // AccessProfiles.InternalKey. DeliveryRecordedAt is unchanged, so it's left alone.
            migrationBuilder.AlterColumn<string>(
                name: "DeliveryMessage",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "DeliveryStatus",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldNullable: true);

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
                name: "InternalKey",
                schema: "identity",
                table: "AccessProfiles");

            migrationBuilder.AlterColumn<string>(
                name: "DeliveryStatus",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "DeliveryMessage",
                schema: "identity",
                table: "InviteTokens",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(512)",
                oldMaxLength: 512,
                oldNullable: true);
        }
    }
}

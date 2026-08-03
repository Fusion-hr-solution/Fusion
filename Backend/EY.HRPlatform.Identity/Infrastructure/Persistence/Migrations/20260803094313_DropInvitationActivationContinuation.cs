using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropInvitationActivationContinuation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InvitationActivationContinuations",
                schema: "identity");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "InvitationActivationContinuations",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvitationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsumedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    HandleDigest = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvitationActivationContinuations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InvitationActivationContinuations_InviteTokens_InvitationId",
                        column: x => x.InvitationId,
                        principalSchema: "identity",
                        principalTable: "InviteTokens",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InvitationActivationContinuations_HandleDigest",
                schema: "identity",
                table: "InvitationActivationContinuations",
                column: "HandleDigest",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InvitationActivationContinuations_InvitationId",
                schema: "identity",
                table: "InvitationActivationContinuations",
                column: "InvitationId");
        }
    }
}

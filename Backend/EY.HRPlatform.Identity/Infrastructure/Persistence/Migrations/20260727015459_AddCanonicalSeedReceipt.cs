using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCanonicalSeedReceipt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CanonicalSeedReceipts",
                schema: "identity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ManifestVersion = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ManifestHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CanonicalSeedReceipts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CanonicalSeedReceipts_TenantId_ManifestVersion",
                schema: "identity",
                table: "CanonicalSeedReceipts",
                columns: new[] { "TenantId", "ManifestVersion" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CanonicalSeedReceipts",
                schema: "identity");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDraftStructureWorkspace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DraftOrgUnits",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DraftOrgUnits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DraftOrgUnits_DraftOrgUnits_ParentId",
                        column: x => x.ParentId,
                        principalSchema: "corehr",
                        principalTable: "DraftOrgUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DraftOrgUnits_ParentId",
                schema: "corehr",
                table: "DraftOrgUnits",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_DraftOrgUnits_TenantId",
                schema: "corehr",
                table: "DraftOrgUnits",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_DraftOrgUnits_TenantId_Code",
                schema: "corehr",
                table: "DraftOrgUnits",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DraftOrgUnits_TenantId_Name",
                schema: "corehr",
                table: "DraftOrgUnits",
                columns: new[] { "TenantId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DraftOrgUnits",
                schema: "corehr");
        }
    }
}

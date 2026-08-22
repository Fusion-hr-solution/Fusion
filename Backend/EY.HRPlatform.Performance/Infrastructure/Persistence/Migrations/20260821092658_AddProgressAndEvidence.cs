using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProgressAndEvidence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CurrentActual",
                schema: "performance",
                table: "Objectives",
                type: "numeric(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CurrentPercentage",
                schema: "performance",
                table: "Objectives",
                type: "numeric(9,4)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastProgressAt",
                schema: "performance",
                table: "Objectives",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProgressUpdates",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    MilestoneId = table.Column<Guid>(type: "uuid", nullable: true),
                    ContextNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsCorrection = table.Column<bool>(type: "boolean", nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgressUpdates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EvidenceItems",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgressUpdateId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FileName = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    ContentType = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    StorageKey = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    Url = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ReferenceText = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvidenceItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvidenceItems_ProgressUpdates_ProgressUpdateId",
                        column: x => x.ProgressUpdateId,
                        principalSchema: "performance",
                        principalTable: "ProgressUpdates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EvidenceItems_ProgressUpdateId",
                schema: "performance",
                table: "EvidenceItems",
                column: "ProgressUpdateId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgressUpdates_CycleId",
                schema: "performance",
                table: "ProgressUpdates",
                column: "CycleId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgressUpdates_ObjectiveId",
                schema: "performance",
                table: "ProgressUpdates",
                column: "ObjectiveId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgressUpdates_TenantId",
                schema: "performance",
                table: "ProgressUpdates",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EvidenceItems",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ProgressUpdates",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "CurrentActual",
                schema: "performance",
                table: "Objectives");

            migrationBuilder.DropColumn(
                name: "CurrentPercentage",
                schema: "performance",
                table: "Objectives");

            migrationBuilder.DropColumn(
                name: "LastProgressAt",
                schema: "performance",
                table: "Objectives");
        }
    }
}

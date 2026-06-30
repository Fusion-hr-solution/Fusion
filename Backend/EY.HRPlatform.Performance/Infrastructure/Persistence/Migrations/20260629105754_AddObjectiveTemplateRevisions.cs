using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddObjectiveTemplateRevisions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ObjectiveTemplateContainers",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Draft"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveTemplateContainers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ObjectiveTemplateRevisions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Draft"),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    MeasurementType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SuggestedWeighting = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    Tags = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TargetValue = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    Unit = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    SuccessCriteria = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    SourceRevisionId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByUserId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ActivatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActivatedByUserId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ActivatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ChangeSummary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    SupersededAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveTemplateRevisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ObjectiveTemplateRevisions_ObjectiveTemplateCategories_Cate~",
                        column: x => x.CategoryId,
                        principalSchema: "performance",
                        principalTable: "ObjectiveTemplateCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ObjectiveTemplateRevisions_ObjectiveTemplateContainers_Tem~",
                        column: x => x.TemplateId,
                        principalSchema: "performance",
                        principalTable: "ObjectiveTemplateContainers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateContainers_TenantId",
                schema: "performance",
                table: "ObjectiveTemplateContainers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateContainers_TenantId_Status",
                schema: "performance",
                table: "ObjectiveTemplateContainers",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateRevisions_CategoryId",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateRevisions_TemplateId",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateRevisions_TemplateId_Status",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                columns: new[] { "TemplateId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateRevisions_TemplateId_VersionNumber",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                columns: new[] { "TemplateId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateRevisions_TenantId",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ObjectiveTemplateRevisions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ObjectiveTemplateContainers",
                schema: "performance");
        }
    }
}

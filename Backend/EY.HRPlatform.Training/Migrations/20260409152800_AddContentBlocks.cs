using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddContentBlocks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ArticleTemplateSections",
                schema: "training");

            migrationBuilder.DropTable(
                name: "ArticleTemplates",
                schema: "training");

            migrationBuilder.DropColumn(
                name: "ContentType",
                schema: "training",
                table: "Chapters");

            migrationBuilder.DropColumn(
                name: "ContentUri",
                schema: "training",
                table: "Chapters");

            migrationBuilder.DropColumn(
                name: "EstimatedDurationMinutes",
                schema: "training",
                table: "Chapters");

            migrationBuilder.DropColumn(
                name: "TextContent",
                schema: "training",
                table: "Chapters");

            migrationBuilder.DropColumn(
                name: "VideoUrl",
                schema: "training",
                table: "Chapters");

            migrationBuilder.AddColumn<string>(
                name: "Layout",
                schema: "training",
                table: "Chapters",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "ContentBlocks",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    TextContent = table.Column<string>(type: "text", nullable: true),
                    ContentUri = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    VideoUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    EstimatedDurationMinutes = table.Column<int>(type: "integer", nullable: true),
                    ChapterId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentBlocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContentBlocks_Chapters_ChapterId",
                        column: x => x.ChapterId,
                        principalSchema: "training",
                        principalTable: "Chapters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ContentBlockProgress",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ContentBlockId = table.Column<Guid>(type: "uuid", nullable: false),
                    Completed = table.Column<bool>(type: "boolean", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentBlockProgress", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContentBlockProgress_ContentBlocks_ContentBlockId",
                        column: x => x.ContentBlockId,
                        principalSchema: "training",
                        principalTable: "ContentBlocks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ContentBlockProgress_ContentBlockId",
                schema: "training",
                table: "ContentBlockProgress",
                column: "ContentBlockId");

            migrationBuilder.CreateIndex(
                name: "IX_ContentBlockProgress_EmployeeId_ContentBlockId",
                schema: "training",
                table: "ContentBlockProgress",
                columns: new[] { "EmployeeId", "ContentBlockId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ContentBlocks_ChapterId_OrderIndex",
                schema: "training",
                table: "ContentBlocks",
                columns: new[] { "ChapterId", "OrderIndex" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ContentBlockProgress",
                schema: "training");

            migrationBuilder.DropTable(
                name: "ContentBlocks",
                schema: "training");

            migrationBuilder.DropColumn(
                name: "Layout",
                schema: "training",
                table: "Chapters");

            migrationBuilder.AddColumn<string>(
                name: "ContentType",
                schema: "training",
                table: "Chapters",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ContentUri",
                schema: "training",
                table: "Chapters",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EstimatedDurationMinutes",
                schema: "training",
                table: "Chapters",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TextContent",
                schema: "training",
                table: "Chapters",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VideoUrl",
                schema: "training",
                table: "Chapters",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ArticleTemplates",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArticleTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ArticleTemplateSections",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    Placeholder = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArticleTemplateSections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArticleTemplateSections_ArticleTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalSchema: "training",
                        principalTable: "ArticleTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ArticleTemplates_Name",
                schema: "training",
                table: "ArticleTemplates",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ArticleTemplateSections_TemplateId_OrderIndex",
                schema: "training",
                table: "ArticleTemplateSections",
                columns: new[] { "TemplateId", "OrderIndex" },
                unique: true);
        }
    }
}

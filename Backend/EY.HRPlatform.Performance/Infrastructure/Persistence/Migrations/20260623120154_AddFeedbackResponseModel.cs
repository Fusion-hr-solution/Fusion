using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedbackResponseModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "FeedbackDeadline",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FeedbackResponseContents",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    FeedbackType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TemplateSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsInvalidated = table.Column<bool>(type: "boolean", nullable: false),
                    InvalidationReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackResponseContents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackTemplateSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    FeedbackType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FrozenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackTemplateSnapshots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackIdentityMappings",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResponseContentId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackIdentityMappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackIdentityMappings_FeedbackResponseContents_ResponseC~",
                        column: x => x.ResponseContentId,
                        principalSchema: "performance",
                        principalTable: "FeedbackResponseContents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackPromptAnswer",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResponseContentId = table.Column<Guid>(type: "uuid", nullable: false),
                    PromptSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    PromptText = table.Column<string>(type: "text", nullable: false),
                    PromptVersion = table.Column<int>(type: "integer", nullable: false),
                    AnswerText = table.Column<string>(type: "text", nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackPromptAnswer", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackPromptAnswer_FeedbackResponseContents_ResponseConte~",
                        column: x => x.ResponseContentId,
                        principalSchema: "performance",
                        principalTable: "FeedbackResponseContents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackResponseVersions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResponseContentId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    AnswersJson = table.Column<string>(type: "text", nullable: false),
                    GeneralComment = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AuthorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackResponseVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackResponseVersions_FeedbackResponseContents_ResponseC~",
                        column: x => x.ResponseContentId,
                        principalSchema: "performance",
                        principalTable: "FeedbackResponseContents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackPromptSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    PromptText = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackPromptSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackPromptSnapshots_FeedbackTemplateSnapshots_TemplateS~",
                        column: x => x.TemplateSnapshotId,
                        principalSchema: "performance",
                        principalTable: "FeedbackTemplateSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackIdentityMappings_ResponseContentId",
                schema: "performance",
                table: "FeedbackIdentityMappings",
                column: "ResponseContentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackPromptAnswer_ResponseContentId",
                schema: "performance",
                table: "FeedbackPromptAnswer",
                column: "ResponseContentId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackPromptSnapshots_TemplateSnapshotId",
                schema: "performance",
                table: "FeedbackPromptSnapshots",
                column: "TemplateSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackResponseVersions_ResponseContentId",
                schema: "performance",
                table: "FeedbackResponseVersions",
                column: "ResponseContentId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackTemplateSnapshots_TenantId_CycleId_FeedbackType",
                schema: "performance",
                table: "FeedbackTemplateSnapshots",
                columns: new[] { "TenantId", "CycleId", "FeedbackType" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FeedbackIdentityMappings",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FeedbackPromptAnswer",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FeedbackPromptSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FeedbackResponseVersions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FeedbackTemplateSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FeedbackResponseContents",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "FeedbackDeadline",
                schema: "performance",
                table: "PerformanceCycles");
        }
    }
}

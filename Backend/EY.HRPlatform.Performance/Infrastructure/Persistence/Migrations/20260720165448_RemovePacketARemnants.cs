using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemovePacketARemnants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CampaignWorkItems",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ExceptionCaseHistoryEntries",
                schema: "performance");

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
                name: "FormalRatingScaleLevelSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FormalReviewCriterionSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceReviewCriterionResponses",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ExceptionCases",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FeedbackTemplateSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FeedbackResponseContents",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FormalReviewDefinitionSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceReviews",
                schema: "performance");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CampaignWorkItems",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssigneeEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    DueAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExceptionCaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceAssignmentRevisionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignWorkItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExceptionCases",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CurrentOwnerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CurrentResolutionWorkItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    FailureCode = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    FrozenReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    FrozenWorkflowContextJson = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PreviousCaseId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolutionAction = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SourceObjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceWorkItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceWorkItemType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    Version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExceptionCases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackResponseContents",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    FeedbackType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    InvalidationReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsInvalidated = table.Column<bool>(type: "boolean", nullable: false),
                    LockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TemplateSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    Version = table.Column<long>(type: "bigint", nullable: false)
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
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    FeedbackType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FrozenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackTemplateSnapshots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FormalReviewDefinitionSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    FrozenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RatingScaleName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormalReviewDefinitionSnapshots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceReviews",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CorrectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CorrectionRequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CorrectionWorkItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    DefinitionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    EvidenceReference = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    FinalizedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Narrative = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    ReviewerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    WorkItemId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceReviews", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExceptionCaseHistoryEntries",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ActorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    ExceptionCaseId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromOwnerEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Outcome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToOwnerEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExceptionCaseHistoryEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExceptionCaseHistoryEntries_ExceptionCases_ExceptionCaseId",
                        column: x => x.ExceptionCaseId,
                        principalSchema: "performance",
                        principalTable: "ExceptionCases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackIdentityMappings",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    ResponseContentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    WorkItemId = table.Column<Guid>(type: "uuid", nullable: false)
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
                    AnswerText = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    PromptSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    PromptText = table.Column<string>(type: "text", nullable: false),
                    PromptVersion = table.Column<int>(type: "integer", nullable: false),
                    ResponseContentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    AnswersJson = table.Column<string>(type: "text", nullable: false),
                    AuthorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    GeneralComment = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    ResponseContentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false)
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
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    PromptText = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    TemplateSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false)
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

            migrationBuilder.CreateTable(
                name: "FormalRatingScaleLevelSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    DefinitionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    Value = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormalRatingScaleLevelSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormalRatingScaleLevelSnapshots_FormalReviewDefinitionSnaps~",
                        column: x => x.DefinitionSnapshotId,
                        principalSchema: "performance",
                        principalTable: "FormalReviewDefinitionSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FormalReviewCriterionSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    DefinitionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormalReviewCriterionSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FormalReviewCriterionSnapshots_FormalReviewDefinitionSnapsh~",
                        column: x => x.DefinitionSnapshotId,
                        principalSchema: "performance",
                        principalTable: "FormalReviewDefinitionSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceReviewCriterionResponses",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CriterionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Rating = table.Column<int>(type: "integer", nullable: false),
                    ReviewId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceReviewCriterionResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformanceReviewCriterionResponses_PerformanceReviews_Revi~",
                        column: x => x.ReviewId,
                        principalSchema: "performance",
                        principalTable: "PerformanceReviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignWorkItems_CycleId_SubjectEmployeeId_Type",
                schema: "performance",
                table: "CampaignWorkItems",
                columns: new[] { "CycleId", "SubjectEmployeeId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignWorkItems_ExceptionCaseId",
                schema: "performance",
                table: "CampaignWorkItems",
                column: "ExceptionCaseId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignWorkItems_SourceAssignmentRevisionId",
                schema: "performance",
                table: "CampaignWorkItems",
                column: "SourceAssignmentRevisionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CampaignWorkItems_TenantId_AssigneeEmployeeId_Status_DueAt",
                schema: "performance",
                table: "CampaignWorkItems",
                columns: new[] { "TenantId", "AssigneeEmployeeId", "Status", "DueAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionCaseHistoryEntries_ExceptionCaseId_OccurredAt",
                schema: "performance",
                table: "ExceptionCaseHistoryEntries",
                columns: new[] { "ExceptionCaseId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionCaseHistoryEntries_TenantId",
                schema: "performance",
                table: "ExceptionCaseHistoryEntries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionCases_CycleId_Status",
                schema: "performance",
                table: "ExceptionCases",
                columns: new[] { "CycleId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionCases_TenantId",
                schema: "performance",
                table: "ExceptionCases",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ExceptionCases_TenantId_SourceWorkItemId_SourceObjectId_Fai~",
                schema: "performance",
                table: "ExceptionCases",
                columns: new[] { "TenantId", "SourceWorkItemId", "SourceObjectId", "FailureCode", "Status" },
                unique: true,
                filter: "\"Status\" = 'Open'");

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

            migrationBuilder.CreateIndex(
                name: "IX_FormalRatingScaleLevelSnapshots_DefinitionSnapshotId_Value",
                schema: "performance",
                table: "FormalRatingScaleLevelSnapshots",
                columns: new[] { "DefinitionSnapshotId", "Value" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormalRatingScaleLevelSnapshots_TenantId",
                schema: "performance",
                table: "FormalRatingScaleLevelSnapshots",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FormalReviewCriterionSnapshots_DefinitionSnapshotId_Display~",
                schema: "performance",
                table: "FormalReviewCriterionSnapshots",
                columns: new[] { "DefinitionSnapshotId", "DisplayOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormalReviewCriterionSnapshots_TenantId",
                schema: "performance",
                table: "FormalReviewCriterionSnapshots",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FormalReviewDefinitionSnapshots_TenantId_CycleId_Kind",
                schema: "performance",
                table: "FormalReviewDefinitionSnapshots",
                columns: new[] { "TenantId", "CycleId", "Kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviewCriterionResponses_ReviewId_CriterionSnaps~",
                schema: "performance",
                table: "PerformanceReviewCriterionResponses",
                columns: new[] { "ReviewId", "CriterionSnapshotId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviewCriterionResponses_TenantId",
                schema: "performance",
                table: "PerformanceReviewCriterionResponses",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviews_TenantId_CycleId_SubjectEmployeeId_Kind",
                schema: "performance",
                table: "PerformanceReviews",
                columns: new[] { "TenantId", "CycleId", "SubjectEmployeeId", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceReviews_WorkItemId",
                schema: "performance",
                table: "PerformanceReviews",
                column: "WorkItemId",
                unique: true);
        }
    }
}

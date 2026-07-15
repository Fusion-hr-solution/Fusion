using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CapturePendingModelChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FeedbackVisibility",
                schema: "performance",
                table: "PerformanceCycles",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "FrozenFeedbackVisibility",
                schema: "performance",
                table: "PerformanceCycles",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FrozenMinimumAnonymousFeedbackResponses",
                schema: "performance",
                table: "PerformanceCycles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "FrozenRequireTeamObjectiveSuperiorApproval",
                schema: "performance",
                table: "PerformanceCycles",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FrozenRetentionPolicyVersionId",
                schema: "performance",
                table: "PerformanceCycles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "GovernanceFrozenAt",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MinimumAnonymousFeedbackResponses",
                schema: "performance",
                table: "PerformanceCycles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "RequireTeamObjectiveSuperiorApproval",
                schema: "performance",
                table: "PerformanceCycles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "RetentionPolicyVersionId",
                schema: "performance",
                table: "PerformanceCycles",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CampaignExceptionOwners",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignExceptionOwners", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CampaignExceptionOwners_PerformanceCycles_CycleId",
                        column: x => x.CycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CampaignLaunchParticipantSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    FullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    EmployeeKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrgUnitName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    JobTitle = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    PrimaryManagerId = table.Column<Guid>(type: "uuid", nullable: true),
                    PrimaryManagerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    FrozenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignLaunchParticipantSnapshots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CampaignWorkItems",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssigneeEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DueAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SourceAssignmentRevisionId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignWorkItems", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FormalReviewDefinitionSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RatingScaleName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    FrozenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormalReviewDefinitionSnapshots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceObjectiveMilestones",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceObjectiveMilestones", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceReviews",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DefinitionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Narrative = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    EvidenceReference = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinalizedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CorrectionWorkItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    CorrectionRequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CorrectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceReviews", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FormalRatingScaleLevelSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    DefinitionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
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
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    DefinitionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
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
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewId = table.Column<Guid>(type: "uuid", nullable: false),
                    CriterionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Rating = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
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
                name: "IX_CampaignExceptionOwners_CycleId_EmployeeId",
                schema: "performance",
                table: "CampaignExceptionOwners",
                columns: new[] { "CycleId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CampaignExceptionOwners_CycleId_Priority",
                schema: "performance",
                table: "CampaignExceptionOwners",
                columns: new[] { "CycleId", "Priority" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CampaignExceptionOwners_TenantId",
                schema: "performance",
                table: "CampaignExceptionOwners",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignLaunchParticipantSnapshots_CycleId_EmployeeId",
                schema: "performance",
                table: "CampaignLaunchParticipantSnapshots",
                columns: new[] { "CycleId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CampaignLaunchParticipantSnapshots_TenantId",
                schema: "performance",
                table: "CampaignLaunchParticipantSnapshots",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignWorkItems_CycleId_SubjectEmployeeId_Type",
                schema: "performance",
                table: "CampaignWorkItems",
                columns: new[] { "CycleId", "SubjectEmployeeId", "Type" });

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
                name: "IX_PerformanceObjectiveMilestones_TenantId_ObjectiveId_DueDate",
                schema: "performance",
                table: "PerformanceObjectiveMilestones",
                columns: new[] { "TenantId", "ObjectiveId", "DueDate" });

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CampaignExceptionOwners",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "CampaignLaunchParticipantSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "CampaignWorkItems",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FormalRatingScaleLevelSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FormalReviewCriterionSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceObjectiveMilestones",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceReviewCriterionResponses",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FormalReviewDefinitionSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceReviews",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "FeedbackVisibility",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "FrozenFeedbackVisibility",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "FrozenMinimumAnonymousFeedbackResponses",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "FrozenRequireTeamObjectiveSuperiorApproval",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "FrozenRetentionPolicyVersionId",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "GovernanceFrozenAt",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "MinimumAnonymousFeedbackResponses",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "RequireTeamObjectiveSuperiorApproval",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "RetentionPolicyVersionId",
                schema: "performance",
                table: "PerformanceCycles");
        }
    }
}

using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PerformanceDbContext))]
[Migration("20260621170000_AddFormalReviewWorkflow")]
public partial class AddFormalReviewWorkflow : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "FormalReviewDefinitionSnapshots", schema: "performance",
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
            }, constraints: table => table.PrimaryKey("PK_FormalReviewDefinitionSnapshots", x => x.Id));
        migrationBuilder.CreateIndex(name: "IX_FormalReviewDefinitionSnapshots_TenantId_CycleId_Kind", schema: "performance", table: "FormalReviewDefinitionSnapshots", columns: new[] { "TenantId", "CycleId", "Kind" }, unique: true);

        migrationBuilder.CreateTable(
            name: "FormalReviewCriterionSnapshots", schema: "performance",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false), TenantId = table.Column<Guid>(type: "uuid", nullable: false), DefinitionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false), Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true), DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), CreatedBy = table.Column<string>(type: "text", nullable: true), UpdatedBy = table.Column<string>(type: "text", nullable: true)
            }, constraints: table =>
            {
                table.PrimaryKey("PK_FormalReviewCriterionSnapshots", x => x.Id);
                table.ForeignKey("FK_FormalReviewCriterionSnapshots_FormalReviewDefinitionSnapshots_DefinitionSnapshotId", x => x.DefinitionSnapshotId, principalSchema: "performance", principalTable: "FormalReviewDefinitionSnapshots", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex(name: "IX_FormalReviewCriterionSnapshots_DefinitionSnapshotId_DisplayOrder", schema: "performance", table: "FormalReviewCriterionSnapshots", columns: new[] { "DefinitionSnapshotId", "DisplayOrder" }, unique: true);
        migrationBuilder.CreateIndex(name: "IX_FormalReviewCriterionSnapshots_TenantId", schema: "performance", table: "FormalReviewCriterionSnapshots", column: "TenantId");

        migrationBuilder.CreateTable(
            name: "FormalRatingScaleLevelSnapshots", schema: "performance",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false), TenantId = table.Column<Guid>(type: "uuid", nullable: false), DefinitionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                Value = table.Column<int>(type: "integer", nullable: false), Label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false), Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), CreatedBy = table.Column<string>(type: "text", nullable: true), UpdatedBy = table.Column<string>(type: "text", nullable: true)
            }, constraints: table =>
            {
                table.PrimaryKey("PK_FormalRatingScaleLevelSnapshots", x => x.Id);
                table.ForeignKey("FK_FormalRatingScaleLevelSnapshots_FormalReviewDefinitionSnapshots_DefinitionSnapshotId", x => x.DefinitionSnapshotId, principalSchema: "performance", principalTable: "FormalReviewDefinitionSnapshots", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex(name: "IX_FormalRatingScaleLevelSnapshots_DefinitionSnapshotId_Value", schema: "performance", table: "FormalRatingScaleLevelSnapshots", columns: new[] { "DefinitionSnapshotId", "Value" }, unique: true);
        migrationBuilder.CreateIndex(name: "IX_FormalRatingScaleLevelSnapshots_TenantId", schema: "performance", table: "FormalRatingScaleLevelSnapshots", column: "TenantId");

        migrationBuilder.CreateTable(
            name: "PerformanceReviews", schema: "performance",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false), TenantId = table.Column<Guid>(type: "uuid", nullable: false), xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                CycleId = table.Column<Guid>(type: "uuid", nullable: false), WorkItemId = table.Column<Guid>(type: "uuid", nullable: false), SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false), ReviewerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false), DefinitionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false), Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                Narrative = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true), EvidenceReference = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true), SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), FinalizedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                CorrectionWorkItemId = table.Column<Guid>(type: "uuid", nullable: true), CorrectionRequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), CorrectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), CreatedBy = table.Column<string>(type: "text", nullable: true), UpdatedBy = table.Column<string>(type: "text", nullable: true)
            }, constraints: table => table.PrimaryKey("PK_PerformanceReviews", x => x.Id));
        migrationBuilder.CreateIndex(name: "IX_PerformanceReviews_WorkItemId", schema: "performance", table: "PerformanceReviews", column: "WorkItemId", unique: true);
        migrationBuilder.CreateIndex(name: "IX_PerformanceReviews_TenantId_CycleId_SubjectEmployeeId_Kind", schema: "performance", table: "PerformanceReviews", columns: new[] { "TenantId", "CycleId", "SubjectEmployeeId", "Kind" });

        migrationBuilder.CreateTable(
            name: "PerformanceReviewCriterionResponses", schema: "performance",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false), TenantId = table.Column<Guid>(type: "uuid", nullable: false), ReviewId = table.Column<Guid>(type: "uuid", nullable: false), CriterionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false), Rating = table.Column<int>(type: "integer", nullable: false), Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), CreatedBy = table.Column<string>(type: "text", nullable: true), UpdatedBy = table.Column<string>(type: "text", nullable: true)
            }, constraints: table =>
            {
                table.PrimaryKey("PK_PerformanceReviewCriterionResponses", x => x.Id);
                table.ForeignKey("FK_PerformanceReviewCriterionResponses_PerformanceReviews_ReviewId", x => x.ReviewId, principalSchema: "performance", principalTable: "PerformanceReviews", principalColumn: "Id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex(name: "IX_PerformanceReviewCriterionResponses_ReviewId_CriterionSnapshotId", schema: "performance", table: "PerformanceReviewCriterionResponses", columns: new[] { "ReviewId", "CriterionSnapshotId" }, unique: true);
        migrationBuilder.CreateIndex(name: "IX_PerformanceReviewCriterionResponses_TenantId", schema: "performance", table: "PerformanceReviewCriterionResponses", column: "TenantId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "PerformanceReviewCriterionResponses", schema: "performance");
        migrationBuilder.DropTable(name: "FormalRatingScaleLevelSnapshots", schema: "performance");
        migrationBuilder.DropTable(name: "FormalReviewCriterionSnapshots", schema: "performance");
        migrationBuilder.DropTable(name: "PerformanceReviews", schema: "performance");
        migrationBuilder.DropTable(name: "FormalReviewDefinitionSnapshots", schema: "performance");
    }
}

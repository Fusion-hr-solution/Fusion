using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSkillsAndEvaluationExecution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DraftSkillScaleDescription",
                schema: "performance",
                table: "EvaluationRounds",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DraftSkillScaleName",
                schema: "performance",
                table: "EvaluationRounds",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DraftSkillSetName",
                schema: "performance",
                table: "EvaluationRounds",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ObjectivesWeightPercent",
                schema: "performance",
                table: "EvaluationRounds",
                type: "integer",
                nullable: false,
                defaultValue: 100);

            migrationBuilder.AddColumn<int>(
                name: "SkillsWeightPercent",
                schema: "performance",
                table: "EvaluationRounds",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "SourceExpectationSetId",
                schema: "performance",
                table: "EvaluationRounds",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ObjectivesWeightPercent",
                schema: "performance",
                table: "EvaluationRoundPolicySnapshots",
                type: "integer",
                nullable: false,
                defaultValue: 100);

            migrationBuilder.AddColumn<int>(
                name: "SkillsWeightPercent",
                schema: "performance",
                table: "EvaluationRoundPolicySnapshots",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "AcknowledgedAt",
                schema: "performance",
                table: "EvaluationAssignments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AcknowledgementComment",
                schema: "performance",
                table: "EvaluationAssignments",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DiscussionSummary",
                schema: "performance",
                table: "EvaluationAssignments",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FinalRatingOrdinal",
                schema: "performance",
                table: "EvaluationAssignments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FinalScore",
                schema: "performance",
                table: "EvaluationAssignments",
                type: "numeric(3,1)",
                precision: 3,
                scale: 1,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FinalizedAt",
                schema: "performance",
                table: "EvaluationAssignments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OverallObjectivesRatingOrdinal",
                schema: "performance",
                table: "EvaluationAssignments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OverallSkillsRatingOrdinal",
                schema: "performance",
                table: "EvaluationAssignments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SkillSnapshotId",
                schema: "performance",
                table: "EvaluationAssignments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedAt",
                schema: "performance",
                table: "EvaluationAssignments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EvaluationObjectiveRatings",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    RatingOrdinal = table.Column<int>(type: "integer", nullable: true),
                    Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationObjectiveRatings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationObjectiveRatings_EvaluationAssignments_Assignment~",
                        column: x => x.AssignmentId,
                        principalSchema: "performance",
                        principalTable: "EvaluationAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationQuestionAnswers",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    TextAnswer = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    RatingOrdinal = table.Column<int>(type: "integer", nullable: true),
                    IsNotApplicable = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    NotApplicableReason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationQuestionAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationQuestionAnswers_EvaluationAssignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalSchema: "performance",
                        principalTable: "EvaluationAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundProficiencyDraftLevels",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceLevelId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundProficiencyDraftLevels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundProficiencyDraftLevels_EvaluationRounds_Roun~",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundSkillDraftItems",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    SkillId = table.Column<Guid>(type: "uuid", nullable: false),
                    SkillName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CategoryName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ExpectedLevelOrdinal = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundSkillDraftItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundSkillDraftItems_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundSkillSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceExpectationSetId = table.Column<Guid>(type: "uuid", nullable: false),
                    SetName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ProficiencyScaleName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundSkillSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundSkillSnapshots_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationSkillRatings",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    SkillSnapshotItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProficiencyOrdinal = table.Column<int>(type: "integer", nullable: true),
                    Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationSkillRatings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationSkillRatings_EvaluationAssignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalSchema: "performance",
                        principalTable: "EvaluationAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProficiencyScales",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Draft"),
                    IsInUse = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProficiencyScales", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SkillCategories",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Active"),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkillCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundSkillSnapshotItems",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SkillSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    SkillId = table.Column<Guid>(type: "uuid", nullable: false),
                    SkillName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    CategoryName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ExpectedLevelOrdinal = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundSkillSnapshotItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundSkillSnapshotItems_EvaluationRoundSkillSnaps~",
                        column: x => x.SkillSnapshotId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRoundSkillSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundSkillSnapshotLevels",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SkillSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceLevelId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundSkillSnapshotLevels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundSkillSnapshotLevels_EvaluationRoundSkillSnap~",
                        column: x => x.SkillSnapshotId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRoundSkillSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProficiencyScaleLevels",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProficiencyScaleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProficiencyScaleLevels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProficiencyScaleLevels_ProficiencyScales_ProficiencyScaleId",
                        column: x => x.ProficiencyScaleId,
                        principalSchema: "performance",
                        principalTable: "ProficiencyScales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SkillExpectationSets",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ProficiencyScaleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Draft"),
                    IsInUse = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkillExpectationSets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SkillExpectationSets_ProficiencyScales_ProficiencyScaleId",
                        column: x => x.ProficiencyScaleId,
                        principalSchema: "performance",
                        principalTable: "ProficiencyScales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Skills",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SkillCategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Active"),
                    IsInUse = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Skills", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Skills_SkillCategories_SkillCategoryId",
                        column: x => x.SkillCategoryId,
                        principalSchema: "performance",
                        principalTable: "SkillCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SkillExpectationItems",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpectationSetId = table.Column<Guid>(type: "uuid", nullable: false),
                    SkillId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpectedLevelOrdinal = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkillExpectationItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SkillExpectationItems_SkillExpectationSets_ExpectationSetId",
                        column: x => x.ExpectationSetId,
                        principalSchema: "performance",
                        principalTable: "SkillExpectationSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SkillExpectationItems_Skills_SkillId",
                        column: x => x.SkillId,
                        principalSchema: "performance",
                        principalTable: "Skills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAssignments_SkillSnapshotId",
                schema: "performance",
                table: "EvaluationAssignments",
                column: "SkillSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationObjectiveRatings_AssignmentId",
                schema: "performance",
                table: "EvaluationObjectiveRatings",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationObjectiveRatings_TenantId_AssignmentId",
                schema: "performance",
                table: "EvaluationObjectiveRatings",
                columns: new[] { "TenantId", "AssignmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationObjectiveRatings_TenantId_AssignmentId_ObjectiveS~",
                schema: "performance",
                table: "EvaluationObjectiveRatings",
                columns: new[] { "TenantId", "AssignmentId", "ObjectiveSnapshotId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationQuestionAnswers_AssignmentId",
                schema: "performance",
                table: "EvaluationQuestionAnswers",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationQuestionAnswers_TenantId_AssignmentId",
                schema: "performance",
                table: "EvaluationQuestionAnswers",
                columns: new[] { "TenantId", "AssignmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationQuestionAnswers_TenantId_AssignmentId_QuestionSna~",
                schema: "performance",
                table: "EvaluationQuestionAnswers",
                columns: new[] { "TenantId", "AssignmentId", "QuestionSnapshotId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundProficiencyDraftLevels_RoundId",
                schema: "performance",
                table: "EvaluationRoundProficiencyDraftLevels",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundProficiencyDraftLevels_TenantId_RoundId_Ordi~",
                schema: "performance",
                table: "EvaluationRoundProficiencyDraftLevels",
                columns: new[] { "TenantId", "RoundId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundSkillDraftItems_RoundId",
                schema: "performance",
                table: "EvaluationRoundSkillDraftItems",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundSkillDraftItems_TenantId_RoundId_SkillId",
                schema: "performance",
                table: "EvaluationRoundSkillDraftItems",
                columns: new[] { "TenantId", "RoundId", "SkillId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundSkillSnapshotItems_SkillSnapshotId",
                schema: "performance",
                table: "EvaluationRoundSkillSnapshotItems",
                column: "SkillSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundSkillSnapshotItems_TenantId_SkillSnapshotId_~",
                schema: "performance",
                table: "EvaluationRoundSkillSnapshotItems",
                columns: new[] { "TenantId", "SkillSnapshotId", "SkillId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundSkillSnapshotLevels_SkillSnapshotId",
                schema: "performance",
                table: "EvaluationRoundSkillSnapshotLevels",
                column: "SkillSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundSkillSnapshotLevels_TenantId_SkillSnapshotId~",
                schema: "performance",
                table: "EvaluationRoundSkillSnapshotLevels",
                columns: new[] { "TenantId", "SkillSnapshotId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundSkillSnapshots_RoundId",
                schema: "performance",
                table: "EvaluationRoundSkillSnapshots",
                column: "RoundId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundSkillSnapshots_TenantId_RoundId",
                schema: "performance",
                table: "EvaluationRoundSkillSnapshots",
                columns: new[] { "TenantId", "RoundId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationSkillRatings_AssignmentId",
                schema: "performance",
                table: "EvaluationSkillRatings",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationSkillRatings_TenantId_AssignmentId",
                schema: "performance",
                table: "EvaluationSkillRatings",
                columns: new[] { "TenantId", "AssignmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationSkillRatings_TenantId_AssignmentId_SkillSnapshotI~",
                schema: "performance",
                table: "EvaluationSkillRatings",
                columns: new[] { "TenantId", "AssignmentId", "SkillSnapshotItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProficiencyScaleLevels_ProficiencyScaleId",
                schema: "performance",
                table: "ProficiencyScaleLevels",
                column: "ProficiencyScaleId");

            migrationBuilder.CreateIndex(
                name: "IX_ProficiencyScaleLevels_TenantId_ProficiencyScaleId_Ordinal",
                schema: "performance",
                table: "ProficiencyScaleLevels",
                columns: new[] { "TenantId", "ProficiencyScaleId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProficiencyScales_TenantId_Status",
                schema: "performance",
                table: "ProficiencyScales",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_ProficiencyScales_Tenant_ActiveName",
                schema: "performance",
                table: "ProficiencyScales",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");

            migrationBuilder.CreateIndex(
                name: "IX_SkillCategories_TenantId_Status",
                schema: "performance",
                table: "SkillCategories",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_SkillCategories_Tenant_ActiveName",
                schema: "performance",
                table: "SkillCategories",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");

            migrationBuilder.CreateIndex(
                name: "IX_SkillExpectationItems_ExpectationSetId",
                schema: "performance",
                table: "SkillExpectationItems",
                column: "ExpectationSetId");

            migrationBuilder.CreateIndex(
                name: "IX_SkillExpectationItems_SkillId",
                schema: "performance",
                table: "SkillExpectationItems",
                column: "SkillId");

            migrationBuilder.CreateIndex(
                name: "IX_SkillExpectationItems_TenantId_ExpectationSetId_SkillId",
                schema: "performance",
                table: "SkillExpectationItems",
                columns: new[] { "TenantId", "ExpectationSetId", "SkillId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SkillExpectationSets_ProficiencyScaleId",
                schema: "performance",
                table: "SkillExpectationSets",
                column: "ProficiencyScaleId");

            migrationBuilder.CreateIndex(
                name: "IX_SkillExpectationSets_TenantId_ProficiencyScaleId",
                schema: "performance",
                table: "SkillExpectationSets",
                columns: new[] { "TenantId", "ProficiencyScaleId" });

            migrationBuilder.CreateIndex(
                name: "IX_SkillExpectationSets_TenantId_Status",
                schema: "performance",
                table: "SkillExpectationSets",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_SkillExpectationSets_Tenant_ActiveName",
                schema: "performance",
                table: "SkillExpectationSets",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");

            migrationBuilder.CreateIndex(
                name: "IX_Skills_SkillCategoryId",
                schema: "performance",
                table: "Skills",
                column: "SkillCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Skills_TenantId_SkillCategoryId",
                schema: "performance",
                table: "Skills",
                columns: new[] { "TenantId", "SkillCategoryId" });

            migrationBuilder.CreateIndex(
                name: "IX_Skills_TenantId_Status",
                schema: "performance",
                table: "Skills",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_Skills_Tenant_ActiveName",
                schema: "performance",
                table: "Skills",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "\"Status\" <> 'Archived'");

            migrationBuilder.AddForeignKey(
                name: "FK_EvaluationAssignments_EvaluationRoundSkillSnapshots_SkillSn~",
                schema: "performance",
                table: "EvaluationAssignments",
                column: "SkillSnapshotId",
                principalSchema: "performance",
                principalTable: "EvaluationRoundSkillSnapshots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EvaluationAssignments_EvaluationRoundSkillSnapshots_SkillSn~",
                schema: "performance",
                table: "EvaluationAssignments");

            migrationBuilder.DropTable(
                name: "EvaluationObjectiveRatings",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationQuestionAnswers",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundProficiencyDraftLevels",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundSkillDraftItems",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundSkillSnapshotItems",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundSkillSnapshotLevels",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationSkillRatings",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ProficiencyScaleLevels",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "SkillExpectationItems",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundSkillSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "SkillExpectationSets",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "Skills",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ProficiencyScales",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "SkillCategories",
                schema: "performance");

            migrationBuilder.DropIndex(
                name: "IX_EvaluationAssignments_SkillSnapshotId",
                schema: "performance",
                table: "EvaluationAssignments");

            migrationBuilder.DropColumn(
                name: "DraftSkillScaleDescription",
                schema: "performance",
                table: "EvaluationRounds");

            migrationBuilder.DropColumn(
                name: "DraftSkillScaleName",
                schema: "performance",
                table: "EvaluationRounds");

            migrationBuilder.DropColumn(
                name: "DraftSkillSetName",
                schema: "performance",
                table: "EvaluationRounds");

            migrationBuilder.DropColumn(
                name: "ObjectivesWeightPercent",
                schema: "performance",
                table: "EvaluationRounds");

            migrationBuilder.DropColumn(
                name: "SkillsWeightPercent",
                schema: "performance",
                table: "EvaluationRounds");

            migrationBuilder.DropColumn(
                name: "SourceExpectationSetId",
                schema: "performance",
                table: "EvaluationRounds");

            migrationBuilder.DropColumn(
                name: "ObjectivesWeightPercent",
                schema: "performance",
                table: "EvaluationRoundPolicySnapshots");

            migrationBuilder.DropColumn(
                name: "SkillsWeightPercent",
                schema: "performance",
                table: "EvaluationRoundPolicySnapshots");

            migrationBuilder.DropColumn(
                name: "AcknowledgedAt",
                schema: "performance",
                table: "EvaluationAssignments");

            migrationBuilder.DropColumn(
                name: "AcknowledgementComment",
                schema: "performance",
                table: "EvaluationAssignments");

            migrationBuilder.DropColumn(
                name: "DiscussionSummary",
                schema: "performance",
                table: "EvaluationAssignments");

            migrationBuilder.DropColumn(
                name: "FinalRatingOrdinal",
                schema: "performance",
                table: "EvaluationAssignments");

            migrationBuilder.DropColumn(
                name: "FinalScore",
                schema: "performance",
                table: "EvaluationAssignments");

            migrationBuilder.DropColumn(
                name: "FinalizedAt",
                schema: "performance",
                table: "EvaluationAssignments");

            migrationBuilder.DropColumn(
                name: "OverallObjectivesRatingOrdinal",
                schema: "performance",
                table: "EvaluationAssignments");

            migrationBuilder.DropColumn(
                name: "OverallSkillsRatingOrdinal",
                schema: "performance",
                table: "EvaluationAssignments");

            migrationBuilder.DropColumn(
                name: "SkillSnapshotId",
                schema: "performance",
                table: "EvaluationAssignments");

            migrationBuilder.DropColumn(
                name: "SubmittedAt",
                schema: "performance",
                table: "EvaluationAssignments");
        }
    }
}

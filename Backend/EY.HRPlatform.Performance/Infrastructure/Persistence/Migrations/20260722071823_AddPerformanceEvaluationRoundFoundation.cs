using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceEvaluationRoundFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EvaluationRatingScales",
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
                    table.PrimaryKey("PK_EvaluationRatingScales", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRounds",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PerformanceCycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    Purpose = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Type = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    AssessmentModel = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Draft"),
                    SelfAssessmentDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ManagerAssessmentDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinalizationDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LaunchedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    SourceRatingScaleId = table.Column<Guid>(type: "uuid", nullable: true),
                    DraftRatingScaleName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    DraftRatingScaleDescription = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SourceTemplateId = table.Column<Guid>(type: "uuid", nullable: true),
                    DraftTemplateName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    DraftTemplatePurpose = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DraftTemplateInstructions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRounds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRounds_PerformanceCycles_PerformanceCycleId",
                        column: x => x.PerformanceCycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationTemplates",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Purpose = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ParticipantInstructions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Draft"),
                    IsInUse = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRatingScaleLevels",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RatingScaleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    BehavioralGuidance = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRatingScaleLevels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRatingScaleLevels_EvaluationRatingScales_RatingSc~",
                        column: x => x.RatingScaleId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRatingScales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationObjectivePlanSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceObjectivePlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationObjectivePlanSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationObjectivePlanSnapshots_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundDeadlineExtensions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeadlineKind = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    PreviousDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NewDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundDeadlineExtensions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundDeadlineExtensions_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundExclusions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundExclusions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundExclusions_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundParticipants",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    CampaignParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrgUnitName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    JobTitle = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ReviewerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ObjectivePlanSnapshotId = table.Column<Guid>(type: "uuid", nullable: true),
                    SnapshotAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundParticipants_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundPolicySnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssessmentModel = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    VisibilityModel = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    SelfAssessmentDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ManagerAssessmentDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FinalizationDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundPolicySnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundPolicySnapshots_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundReviewerCorrections",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundReviewerCorrections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundReviewerCorrections_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundScaleDraftLevels",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceLevelId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    BehavioralGuidance = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundScaleDraftLevels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundScaleDraftLevels_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundScaleSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceRatingScaleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundScaleSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundScaleSnapshots_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundTemplateDraftSections",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceSectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Guidance = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundTemplateDraftSections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundTemplateDraftSections_EvaluationRounds_Round~",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundTemplateSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceTemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Purpose = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ParticipantInstructions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundTemplateSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundTemplateSnapshots_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationTemplateSections",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Guidance = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationTemplateSections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationTemplateSections_EvaluationTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalSchema: "performance",
                        principalTable: "EvaluationTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationObjectiveSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectivePlanSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    AlignmentType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    AlignmentTargetId = table.Column<Guid>(type: "uuid", nullable: true),
                    AlignmentTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Weight = table.Column<int>(type: "integer", nullable: true),
                    Deadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MeasurementMethod = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    MeasurementIndicator = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TargetValue = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    TargetUnit = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    SuccessCriteria = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationObjectiveSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationObjectiveSnapshots_EvaluationObjectivePlanSnapsho~",
                        column: x => x.ObjectivePlanSnapshotId,
                        principalSchema: "performance",
                        principalTable: "EvaluationObjectivePlanSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationAssignments",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Kind = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    AssigneeEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssigneeName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ScaleSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectivePlanSnapshotId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false, defaultValue: "NotStarted"),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationAssignments_EvaluationRoundParticipants_RoundPart~",
                        column: x => x.RoundParticipantId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRoundParticipants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EvaluationAssignments_EvaluationRounds_RoundId",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundScaleSnapshotLevels",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScaleSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceLevelId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Label = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    BehavioralGuidance = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundScaleSnapshotLevels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundScaleSnapshotLevels_EvaluationRoundScaleSnap~",
                        column: x => x.ScaleSnapshotId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRoundScaleSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundTemplateDraftQuestions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    DraftSectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceQuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Prompt = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    TargetRater = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AllowNotApplicable = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundTemplateDraftQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundTemplateDraftQuestions_EvaluationRoundTempla~",
                        column: x => x.DraftSectionId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRoundTemplateDraftSections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundTemplateDraftQuestions_EvaluationRounds_Roun~",
                        column: x => x.RoundId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundTemplateSnapshotSections",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceSectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Guidance = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundTemplateSnapshotSections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundTemplateSnapshotSections_EvaluationRoundTemp~",
                        column: x => x.TemplateSnapshotId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRoundTemplateSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationTemplateQuestions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    SectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Prompt = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    TargetRater = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AllowNotApplicable = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationTemplateQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationTemplateQuestions_EvaluationTemplateSections_Sect~",
                        column: x => x.SectionId,
                        principalSchema: "performance",
                        principalTable: "EvaluationTemplateSections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EvaluationTemplateQuestions_EvaluationTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalSchema: "performance",
                        principalTable: "EvaluationTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EvaluationRoundTemplateSnapshotQuestions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TemplateSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    SectionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceQuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    Prompt = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    TargetRater = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AllowNotApplicable = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationRoundTemplateSnapshotQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundTemplateSnapshotQuestions_EvaluationRoundTem~",
                        column: x => x.SectionSnapshotId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRoundTemplateSnapshotSections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EvaluationRoundTemplateSnapshotQuestions_EvaluationRoundTe~1",
                        column: x => x.TemplateSnapshotId,
                        principalSchema: "performance",
                        principalTable: "EvaluationRoundTemplateSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAssignments_RoundId",
                schema: "performance",
                table: "EvaluationAssignments",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAssignments_RoundParticipantId",
                schema: "performance",
                table: "EvaluationAssignments",
                column: "RoundParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAssignments_TenantId_AssigneeEmployeeId_Status",
                schema: "performance",
                table: "EvaluationAssignments",
                columns: new[] { "TenantId", "AssigneeEmployeeId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAssignments_TenantId_ParticipantEmployeeId_Status",
                schema: "performance",
                table: "EvaluationAssignments",
                columns: new[] { "TenantId", "ParticipantEmployeeId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationAssignments_TenantId_RoundId_Status",
                schema: "performance",
                table: "EvaluationAssignments",
                columns: new[] { "TenantId", "RoundId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_EvaluationAssignments_Tenant_Round_Participant_Kind",
                schema: "performance",
                table: "EvaluationAssignments",
                columns: new[] { "TenantId", "RoundId", "ParticipantEmployeeId", "Kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationObjectivePlanSnapshots_RoundId",
                schema: "performance",
                table: "EvaluationObjectivePlanSnapshots",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationObjectivePlanSnapshots_TenantId_RoundId_Participa~",
                schema: "performance",
                table: "EvaluationObjectivePlanSnapshots",
                columns: new[] { "TenantId", "RoundId", "ParticipantEmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationObjectivePlanSnapshots_TenantId_SourceObjectivePl~",
                schema: "performance",
                table: "EvaluationObjectivePlanSnapshots",
                columns: new[] { "TenantId", "SourceObjectivePlanId" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationObjectiveSnapshots_ObjectivePlanSnapshotId",
                schema: "performance",
                table: "EvaluationObjectiveSnapshots",
                column: "ObjectivePlanSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationObjectiveSnapshots_TenantId_ObjectivePlanSnapshot~",
                schema: "performance",
                table: "EvaluationObjectiveSnapshots",
                columns: new[] { "TenantId", "ObjectivePlanSnapshotId", "SourceObjectiveId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRatingScaleLevels_RatingScaleId",
                schema: "performance",
                table: "EvaluationRatingScaleLevels",
                column: "RatingScaleId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRatingScaleLevels_TenantId_RatingScaleId_Ordinal",
                schema: "performance",
                table: "EvaluationRatingScaleLevels",
                columns: new[] { "TenantId", "RatingScaleId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRatingScales_TenantId_Name_Status",
                schema: "performance",
                table: "EvaluationRatingScales",
                columns: new[] { "TenantId", "Name", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRatingScales_TenantId_Status",
                schema: "performance",
                table: "EvaluationRatingScales",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_EvaluationRatingScales_Tenant_ActiveName",
                schema: "performance",
                table: "EvaluationRatingScales",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "\"Status\" = 'Active'");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundDeadlineExtensions_RoundId",
                schema: "performance",
                table: "EvaluationRoundDeadlineExtensions",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundDeadlineExtensions_TenantId_RoundId_Occurred~",
                schema: "performance",
                table: "EvaluationRoundDeadlineExtensions",
                columns: new[] { "TenantId", "RoundId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundExclusions_RoundId",
                schema: "performance",
                table: "EvaluationRoundExclusions",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundExclusions_TenantId_RoundId_ParticipantEmplo~",
                schema: "performance",
                table: "EvaluationRoundExclusions",
                columns: new[] { "TenantId", "RoundId", "ParticipantEmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundParticipants_RoundId",
                schema: "performance",
                table: "EvaluationRoundParticipants",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundParticipants_TenantId_EmployeeId",
                schema: "performance",
                table: "EvaluationRoundParticipants",
                columns: new[] { "TenantId", "EmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundParticipants_TenantId_RoundId_EmployeeId",
                schema: "performance",
                table: "EvaluationRoundParticipants",
                columns: new[] { "TenantId", "RoundId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundParticipants_TenantId_RoundId_ReviewerEmploy~",
                schema: "performance",
                table: "EvaluationRoundParticipants",
                columns: new[] { "TenantId", "RoundId", "ReviewerEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundPolicySnapshots_RoundId",
                schema: "performance",
                table: "EvaluationRoundPolicySnapshots",
                column: "RoundId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundPolicySnapshots_TenantId_RoundId",
                schema: "performance",
                table: "EvaluationRoundPolicySnapshots",
                columns: new[] { "TenantId", "RoundId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundReviewerCorrections_RoundId",
                schema: "performance",
                table: "EvaluationRoundReviewerCorrections",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundReviewerCorrections_TenantId_ReviewerEmploye~",
                schema: "performance",
                table: "EvaluationRoundReviewerCorrections",
                columns: new[] { "TenantId", "ReviewerEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundReviewerCorrections_TenantId_RoundId_Partici~",
                schema: "performance",
                table: "EvaluationRoundReviewerCorrections",
                columns: new[] { "TenantId", "RoundId", "ParticipantEmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRounds_PerformanceCycleId",
                schema: "performance",
                table: "EvaluationRounds",
                column: "PerformanceCycleId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRounds_TenantId_PerformanceCycleId_Status",
                schema: "performance",
                table: "EvaluationRounds",
                columns: new[] { "TenantId", "PerformanceCycleId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRounds_TenantId_SourceRatingScaleId",
                schema: "performance",
                table: "EvaluationRounds",
                columns: new[] { "TenantId", "SourceRatingScaleId" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRounds_TenantId_SourceTemplateId",
                schema: "performance",
                table: "EvaluationRounds",
                columns: new[] { "TenantId", "SourceTemplateId" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRounds_TenantId_Status",
                schema: "performance",
                table: "EvaluationRounds",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundScaleDraftLevels_RoundId",
                schema: "performance",
                table: "EvaluationRoundScaleDraftLevels",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundScaleDraftLevels_TenantId_RoundId_Ordinal",
                schema: "performance",
                table: "EvaluationRoundScaleDraftLevels",
                columns: new[] { "TenantId", "RoundId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundScaleSnapshotLevels_ScaleSnapshotId",
                schema: "performance",
                table: "EvaluationRoundScaleSnapshotLevels",
                column: "ScaleSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundScaleSnapshotLevels_TenantId_ScaleSnapshotId~",
                schema: "performance",
                table: "EvaluationRoundScaleSnapshotLevels",
                columns: new[] { "TenantId", "ScaleSnapshotId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundScaleSnapshots_RoundId",
                schema: "performance",
                table: "EvaluationRoundScaleSnapshots",
                column: "RoundId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundScaleSnapshots_TenantId_RoundId",
                schema: "performance",
                table: "EvaluationRoundScaleSnapshots",
                columns: new[] { "TenantId", "RoundId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateDraftQuestions_DraftSectionId",
                schema: "performance",
                table: "EvaluationRoundTemplateDraftQuestions",
                column: "DraftSectionId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateDraftQuestions_RoundId",
                schema: "performance",
                table: "EvaluationRoundTemplateDraftQuestions",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateDraftQuestions_TenantId_RoundId_Draf~",
                schema: "performance",
                table: "EvaluationRoundTemplateDraftQuestions",
                columns: new[] { "TenantId", "RoundId", "DraftSectionId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateDraftSections_RoundId",
                schema: "performance",
                table: "EvaluationRoundTemplateDraftSections",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateDraftSections_TenantId_RoundId_Ordin~",
                schema: "performance",
                table: "EvaluationRoundTemplateDraftSections",
                columns: new[] { "TenantId", "RoundId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateSnapshotQuestions_SectionSnapshotId",
                schema: "performance",
                table: "EvaluationRoundTemplateSnapshotQuestions",
                column: "SectionSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateSnapshotQuestions_TemplateSnapshotId",
                schema: "performance",
                table: "EvaluationRoundTemplateSnapshotQuestions",
                column: "TemplateSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateSnapshotQuestions_TenantId_TemplateS~",
                schema: "performance",
                table: "EvaluationRoundTemplateSnapshotQuestions",
                columns: new[] { "TenantId", "TemplateSnapshotId", "SectionSnapshotId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateSnapshots_RoundId",
                schema: "performance",
                table: "EvaluationRoundTemplateSnapshots",
                column: "RoundId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateSnapshots_TenantId_RoundId",
                schema: "performance",
                table: "EvaluationRoundTemplateSnapshots",
                columns: new[] { "TenantId", "RoundId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateSnapshotSections_TemplateSnapshotId",
                schema: "performance",
                table: "EvaluationRoundTemplateSnapshotSections",
                column: "TemplateSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationRoundTemplateSnapshotSections_TenantId_TemplateSn~",
                schema: "performance",
                table: "EvaluationRoundTemplateSnapshotSections",
                columns: new[] { "TenantId", "TemplateSnapshotId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationTemplateQuestions_SectionId",
                schema: "performance",
                table: "EvaluationTemplateQuestions",
                column: "SectionId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationTemplateQuestions_TemplateId",
                schema: "performance",
                table: "EvaluationTemplateQuestions",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationTemplateQuestions_TenantId_TemplateId_SectionId_O~",
                schema: "performance",
                table: "EvaluationTemplateQuestions",
                columns: new[] { "TenantId", "TemplateId", "SectionId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationTemplates_TenantId_Name_Status",
                schema: "performance",
                table: "EvaluationTemplates",
                columns: new[] { "TenantId", "Name", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationTemplates_TenantId_Status",
                schema: "performance",
                table: "EvaluationTemplates",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_EvaluationTemplates_Tenant_ActiveName",
                schema: "performance",
                table: "EvaluationTemplates",
                columns: new[] { "TenantId", "Name" },
                unique: true,
                filter: "\"Status\" = 'Active'");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationTemplateSections_TemplateId",
                schema: "performance",
                table: "EvaluationTemplateSections",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationTemplateSections_TenantId_TemplateId_Ordinal",
                schema: "performance",
                table: "EvaluationTemplateSections",
                columns: new[] { "TenantId", "TemplateId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationTemplateSections_TenantId_TemplateId_Type",
                schema: "performance",
                table: "EvaluationTemplateSections",
                columns: new[] { "TenantId", "TemplateId", "Type" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EvaluationAssignments",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationObjectiveSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRatingScaleLevels",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundDeadlineExtensions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundExclusions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundPolicySnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundReviewerCorrections",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundScaleDraftLevels",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundScaleSnapshotLevels",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundTemplateDraftQuestions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundTemplateSnapshotQuestions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationTemplateQuestions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundParticipants",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationObjectivePlanSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRatingScales",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundScaleSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundTemplateDraftSections",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundTemplateSnapshotSections",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationTemplateSections",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRoundTemplateSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationTemplates",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "EvaluationRounds",
                schema: "performance");
        }
    }
}

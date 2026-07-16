using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class P12ObjectivePlanningPopulationLaunch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CampaignAssignmentResponsibilities",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "CampaignExceptionOwners",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "CampaignLaunchParticipantSnapshots",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "ActivatedAt",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "AssignmentPreparationStartedAt",
                schema: "performance",
                table: "PerformanceCycles");

            migrationBuilder.DropColumn(
                name: "FeedbackDeadline",
                schema: "performance",
                table: "PerformanceCycles");

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
                name: "PublishedAt",
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

            migrationBuilder.RenameColumn(
                name: "ReadyToLaunchAt",
                schema: "performance",
                table: "PerformanceCycles",
                newName: "LaunchedAt");

            migrationBuilder.AddColumn<string>(
                name: "Reason",
                schema: "performance",
                table: "PerformanceCyclePopulationRules",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApproverEmployeeId",
                schema: "performance",
                table: "PerformanceCycleParticipants",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "ApproverName",
                schema: "performance",
                table: "PerformanceCycleParticipants",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ApproverOverrideReason",
                schema: "performance",
                table: "PerformanceCycleParticipants",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsApproverOverridden",
                schema: "performance",
                table: "PerformanceCycleParticipants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "PerformanceCycleApproverOverrides",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApproverEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ApproverName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceCycleApproverOverrides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformanceCycleApproverOverrides_PerformanceCycles_CycleId",
                        column: x => x.CycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCycleApproverOverrides_Cycle_Participant",
                schema: "performance",
                table: "PerformanceCycleApproverOverrides",
                columns: new[] { "CycleId", "ParticipantEmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCycleApproverOverrides_TenantId",
                schema: "performance",
                table: "PerformanceCycleApproverOverrides",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PerformanceCycleApproverOverrides",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "Reason",
                schema: "performance",
                table: "PerformanceCyclePopulationRules");

            migrationBuilder.DropColumn(
                name: "ApproverEmployeeId",
                schema: "performance",
                table: "PerformanceCycleParticipants");

            migrationBuilder.DropColumn(
                name: "ApproverName",
                schema: "performance",
                table: "PerformanceCycleParticipants");

            migrationBuilder.DropColumn(
                name: "ApproverOverrideReason",
                schema: "performance",
                table: "PerformanceCycleParticipants");

            migrationBuilder.DropColumn(
                name: "IsApproverOverridden",
                schema: "performance",
                table: "PerformanceCycleParticipants");

            migrationBuilder.RenameColumn(
                name: "LaunchedAt",
                schema: "performance",
                table: "PerformanceCycles",
                newName: "ReadyToLaunchAt");

            migrationBuilder.AddColumn<DateTime>(
                name: "ActivatedAt",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AssignmentPreparationStartedAt",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FeedbackDeadline",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

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

            migrationBuilder.AddColumn<DateTime>(
                name: "PublishedAt",
                schema: "performance",
                table: "PerformanceCycles",
                type: "timestamp with time zone",
                nullable: true);

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
                name: "CampaignAssignmentResponsibilities",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssigneeEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssigneeName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Duty = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IsFinal = table.Column<bool>(type: "boolean", nullable: false),
                    OverrideReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RelationshipSource = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Revision = table.Column<int>(type: "integer", nullable: false),
                    Source = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignAssignmentResponsibilities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CampaignExceptionOwners",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FrozenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    JobTitle = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrgUnitName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    PrimaryManagerId = table.Column<Guid>(type: "uuid", nullable: true),
                    PrimaryManagerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignLaunchParticipantSnapshots", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignAssignmentResponsibilities_CycleId_AssigneeEmployee~",
                schema: "performance",
                table: "CampaignAssignmentResponsibilities",
                columns: new[] { "CycleId", "AssigneeEmployeeId", "IsFinal" });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignAssignmentResponsibilities_CycleId_SubjectEmployeeI~",
                schema: "performance",
                table: "CampaignAssignmentResponsibilities",
                columns: new[] { "CycleId", "SubjectEmployeeId", "Duty", "Revision" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CampaignAssignmentResponsibilities_TenantId",
                schema: "performance",
                table: "CampaignAssignmentResponsibilities",
                column: "TenantId");

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
        }
    }
}

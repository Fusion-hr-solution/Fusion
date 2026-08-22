using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialPerformanceCycleAndGoals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "performance");

            migrationBuilder.CreateTable(
                name: "CycleSettings",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DefaultMeasurementMethod = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SuggestedObjectiveCountMin = table.Column<int>(type: "integer", nullable: false),
                    SuggestedObjectiveCountMax = table.Column<int>(type: "integer", nullable: false),
                    PlanningDeadlineOffsetDays = table.Column<int>(type: "integer", nullable: false),
                    AllowStandaloneObjectives = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CycleSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Objectives",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnershipScope = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    AccountablePersonId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrgUnitName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ParentObjectiveId = table.Column<Guid>(type: "uuid", nullable: true),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ProgressSource = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Measurement_Method = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Measurement_Baseline = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    Measurement_Target = table.Column<decimal>(type: "numeric(18,4)", nullable: true),
                    Measurement_Unit = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Measurement_Direction = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ContributionBaselineLockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Objectives", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Participants",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    JobTitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrgUnitName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ManagerEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ManagerDisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ByExplicitInclusion = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Participants", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceCycles",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PlanningDeadline = table.Column<DateOnly>(type: "date", nullable: false),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ActivatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActiveTenantSlot = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceCycles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PopulationDefinitions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Mode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EligibilityDate = table.Column<DateOnly>(type: "date", nullable: false),
                    IsConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    ConfirmedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PopulationDefinitions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ObjectiveContributionLinks",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChildObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    Weight = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveContributionLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ObjectiveContributionLinks_Objectives_ObjectiveId",
                        column: x => x.ObjectiveId,
                        principalSchema: "performance",
                        principalTable: "Objectives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ObjectiveDecisions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ActorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Feedback = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveDecisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ObjectiveDecisions_Objectives_ObjectiveId",
                        column: x => x.ObjectiveId,
                        principalSchema: "performance",
                        principalTable: "Objectives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ObjectiveMilestones",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Weight = table.Column<decimal>(type: "numeric(6,2)", nullable: false),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveMilestones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ObjectiveMilestones_Objectives_ObjectiveId",
                        column: x => x.ObjectiveId,
                        principalSchema: "performance",
                        principalTable: "Objectives",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ActivationSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    CapturedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CycleName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PlanningDeadline = table.Column<DateOnly>(type: "date", nullable: false),
                    EligibilityDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ConfirmedParticipantCount = table.Column<int>(type: "integer", nullable: false),
                    SettingsJson = table.Column<string>(type: "jsonb", nullable: false),
                    PopulationRuleJson = table.Column<string>(type: "jsonb", nullable: false),
                    RosterJson = table.Column<string>(type: "jsonb", nullable: false),
                    StrategyJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivationSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ActivationSnapshots_PerformanceCycles_CycleId",
                        column: x => x.CycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PopulationExclusions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PopulationDefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PopulationExclusions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PopulationExclusions_PopulationDefinitions_PopulationDefini~",
                        column: x => x.PopulationDefinitionId,
                        principalSchema: "performance",
                        principalTable: "PopulationDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PopulationInclusions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PopulationDefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PopulationInclusions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PopulationInclusions_PopulationDefinitions_PopulationDefini~",
                        column: x => x.PopulationDefinitionId,
                        principalSchema: "performance",
                        principalTable: "PopulationDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PopulationOrgUnitSelections",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PopulationDefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    IncludeDescendants = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PopulationOrgUnitSelections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PopulationOrgUnitSelections_PopulationDefinitions_Populatio~",
                        column: x => x.PopulationDefinitionId,
                        principalSchema: "performance",
                        principalTable: "PopulationDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivationSnapshots_CycleId",
                schema: "performance",
                table: "ActivationSnapshots",
                column: "CycleId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CycleSettings_TenantId",
                schema: "performance",
                table: "CycleSettings",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveContributionLinks_ObjectiveId",
                schema: "performance",
                table: "ObjectiveContributionLinks",
                column: "ObjectiveId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveContributionLinks_ObjectiveId_ChildObjectiveId",
                schema: "performance",
                table: "ObjectiveContributionLinks",
                columns: new[] { "ObjectiveId", "ChildObjectiveId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveDecisions_ObjectiveId",
                schema: "performance",
                table: "ObjectiveDecisions",
                column: "ObjectiveId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveMilestones_ObjectiveId",
                schema: "performance",
                table: "ObjectiveMilestones",
                column: "ObjectiveId");

            migrationBuilder.CreateIndex(
                name: "IX_Objectives_CycleId",
                schema: "performance",
                table: "Objectives",
                column: "CycleId");

            migrationBuilder.CreateIndex(
                name: "IX_Objectives_ParentObjectiveId",
                schema: "performance",
                table: "Objectives",
                column: "ParentObjectiveId");

            migrationBuilder.CreateIndex(
                name: "IX_Objectives_TenantId",
                schema: "performance",
                table: "Objectives",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Participants_CycleId_EmployeeId",
                schema: "performance",
                table: "Participants",
                columns: new[] { "CycleId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Participants_TenantId",
                schema: "performance",
                table: "Participants",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCycles_ActiveTenantSlot",
                schema: "performance",
                table: "PerformanceCycles",
                column: "ActiveTenantSlot",
                unique: true,
                filter: "\"ActiveTenantSlot\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCycles_TenantId",
                schema: "performance",
                table: "PerformanceCycles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PopulationDefinitions_CycleId",
                schema: "performance",
                table: "PopulationDefinitions",
                column: "CycleId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PopulationDefinitions_TenantId",
                schema: "performance",
                table: "PopulationDefinitions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PopulationExclusions_PopulationDefinitionId_EmployeeId",
                schema: "performance",
                table: "PopulationExclusions",
                columns: new[] { "PopulationDefinitionId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PopulationInclusions_PopulationDefinitionId_EmployeeId",
                schema: "performance",
                table: "PopulationInclusions",
                columns: new[] { "PopulationDefinitionId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PopulationOrgUnitSelections_PopulationDefinitionId",
                schema: "performance",
                table: "PopulationOrgUnitSelections",
                column: "PopulationDefinitionId");

            migrationBuilder.CreateIndex(
                name: "IX_PopulationOrgUnitSelections_PopulationDefinitionId_OrgUnitId",
                schema: "performance",
                table: "PopulationOrgUnitSelections",
                columns: new[] { "PopulationDefinitionId", "OrgUnitId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActivationSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "CycleSettings",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ObjectiveContributionLinks",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ObjectiveDecisions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ObjectiveMilestones",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "Participants",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PopulationExclusions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PopulationInclusions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PopulationOrgUnitSelections",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceCycles",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "Objectives",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PopulationDefinitions",
                schema: "performance");
        }
    }
}

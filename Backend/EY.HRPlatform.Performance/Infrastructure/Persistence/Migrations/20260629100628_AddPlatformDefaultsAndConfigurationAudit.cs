using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPlatformDefaultsAndConfigurationAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PerformanceConfigurationAuditEntries",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    Scope = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Action = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PreviousValue = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    NewValue = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CorrelationId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceConfigurationAuditEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlatformObjectiveBaselines",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformObjectiveBaselines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlatformPerformanceGuardrails",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    MinObjectivesPerPlan = table.Column<int>(type: "integer", nullable: false),
                    MaxObjectivesPerPlan = table.Column<int>(type: "integer", nullable: false),
                    MinManagerValidationSlaDays = table.Column<int>(type: "integer", nullable: false),
                    MaxManagerValidationSlaDays = table.Column<int>(type: "integer", nullable: false),
                    PermittedWeightDecimalPlaces = table.Column<int>(type: "integer", nullable: false),
                    MaxAllowedWeightingValues = table.Column<int>(type: "integer", nullable: false),
                    SupportedMeasurementTypes = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MaxTemplateTitleLength = table.Column<int>(type: "integer", nullable: false),
                    MaxTemplateDescriptionLength = table.Column<int>(type: "integer", nullable: false),
                    MaxTemplateTags = table.Column<int>(type: "integer", nullable: false),
                    ObjectiveLibraryEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    IsDraft = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformPerformanceGuardrails", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlatformObjectiveBaselineVersions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BaselineId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MaxObjectivesPerPlan = table.Column<int>(type: "integer", nullable: false),
                    AllowedWeightValues = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ManagerValidationSlaDays = table.Column<int>(type: "integer", nullable: false),
                    CascadeMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MeasurementTypes = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    AttachmentsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SupersededAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformObjectiveBaselineVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlatformObjectiveBaselineVersions_PlatformObjectiveBaseline~",
                        column: x => x.BaselineId,
                        principalSchema: "performance",
                        principalTable: "PlatformObjectiveBaselines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceConfigurationAudit_Entity",
                schema: "performance",
                table: "PerformanceConfigurationAuditEntries",
                columns: new[] { "EntityType", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceConfigurationAudit_OccurredAt",
                schema: "performance",
                table: "PerformanceConfigurationAuditEntries",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceConfigurationAudit_Scope_OccurredAt",
                schema: "performance",
                table: "PerformanceConfigurationAuditEntries",
                columns: new[] { "Scope", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceConfigurationAudit_Tenant_OccurredAt",
                schema: "performance",
                table: "PerformanceConfigurationAuditEntries",
                columns: new[] { "TenantId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PlatformObjectiveBaselineVersions_Baseline_Status",
                schema: "performance",
                table: "PlatformObjectiveBaselineVersions",
                columns: new[] { "BaselineId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_PlatformObjectiveBaselineVersions_BaselineId",
                schema: "performance",
                table: "PlatformObjectiveBaselineVersions",
                column: "BaselineId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PerformanceConfigurationAuditEntries",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PlatformObjectiveBaselineVersions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PlatformPerformanceGuardrails",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PlatformObjectiveBaselines",
                schema: "performance");
        }
    }
}

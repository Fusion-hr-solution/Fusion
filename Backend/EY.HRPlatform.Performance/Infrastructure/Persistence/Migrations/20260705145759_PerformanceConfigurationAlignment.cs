using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PerformanceConfigurationAlignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ObjectiveTemplateRevisions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ObjectiveTemplateCategories",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ObjectiveTemplateContainers",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "AttachmentsEnabled",
                schema: "performance",
                table: "TenantObjectivePolicyVersions");

            migrationBuilder.DropColumn(
                name: "CascadeMode",
                schema: "performance",
                table: "TenantObjectivePolicyVersions");

            migrationBuilder.DropColumn(
                name: "ManagerValidationSlaDays",
                schema: "performance",
                table: "TenantObjectivePolicyVersions");

            migrationBuilder.DropColumn(
                name: "MaxAllowedWeightingValues",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "MaxManagerValidationSlaDays",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "MaxTemplateDescriptionLength",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "MaxTemplateTags",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "MaxTemplateTitleLength",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "MinManagerValidationSlaDays",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "MinObjectivesPerPlan",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "PermittedWeightDecimalPlaces",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "SupportedMeasurementTypes",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "AttachmentsEnabled",
                schema: "performance",
                table: "PlatformObjectiveBaselineVersions");

            migrationBuilder.DropColumn(
                name: "CascadeMode",
                schema: "performance",
                table: "PlatformObjectiveBaselineVersions");

            migrationBuilder.DropColumn(
                name: "ManagerValidationSlaDays",
                schema: "performance",
                table: "PlatformObjectiveBaselineVersions");

            migrationBuilder.AddColumn<bool>(
                name: "QualitativeAvailable",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "QuantitativeAvailable",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "SupportedAllowedWeightValues",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "5,10,15,20,25,30,40,50");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QualitativeAvailable",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "QuantitativeAvailable",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.DropColumn(
                name: "SupportedAllowedWeightValues",
                schema: "performance",
                table: "PlatformPerformanceGuardrails");

            migrationBuilder.AddColumn<bool>(
                name: "AttachmentsEnabled",
                schema: "performance",
                table: "TenantObjectivePolicyVersions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CascadeMode",
                schema: "performance",
                table: "TenantObjectivePolicyVersions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ManagerValidationSlaDays",
                schema: "performance",
                table: "TenantObjectivePolicyVersions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxAllowedWeightingValues",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxManagerValidationSlaDays",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxTemplateDescriptionLength",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxTemplateTags",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxTemplateTitleLength",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MinManagerValidationSlaDays",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MinObjectivesPerPlan",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PermittedWeightDecimalPlaces",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "SupportedMeasurementTypes",
                schema: "performance",
                table: "PlatformPerformanceGuardrails",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "AttachmentsEnabled",
                schema: "performance",
                table: "PlatformObjectiveBaselineVersions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CascadeMode",
                schema: "performance",
                table: "PlatformObjectiveBaselineVersions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "ManagerValidationSlaDays",
                schema: "performance",
                table: "PlatformObjectiveBaselineVersions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ObjectiveTemplateCategories",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveTemplateCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ObjectiveTemplateContainers",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Draft"),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveTemplateContainers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ObjectiveTemplateRevisions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActivatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActivatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ActivatedByUserId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ApplicabilityValidationState = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "NotValidated"),
                    ApplicableEmploymentTypes = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'[]'"),
                    ApplicableJobTitles = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'[]'"),
                    ApplicableOrgUnitAndDescendantIds = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'[]'"),
                    ApplicableOrgUnitIds = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'[]'"),
                    ApplicableWorkLocations = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'[]'"),
                    ChangeSummary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    CreatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CreatedByUserId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ExpectedOutcome = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Indicator = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    MeasurementType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SourceRevisionId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Draft"),
                    SuccessCriteria = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    SuggestedWeighting = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    SupersededAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Tags = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TargetValue = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Unit = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveTemplateRevisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ObjectiveTemplateRevisions_ObjectiveTemplateCategories_Cate~",
                        column: x => x.CategoryId,
                        principalSchema: "performance",
                        principalTable: "ObjectiveTemplateCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ObjectiveTemplateRevisions_ObjectiveTemplateContainers_Temp~",
                        column: x => x.TemplateId,
                        principalSchema: "performance",
                        principalTable: "ObjectiveTemplateContainers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateCategories_TenantId",
                schema: "performance",
                table: "ObjectiveTemplateCategories",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateCategories_TenantId_Code",
                schema: "performance",
                table: "ObjectiveTemplateCategories",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateCategories_TenantId_NormalizedName",
                schema: "performance",
                table: "ObjectiveTemplateCategories",
                columns: new[] { "TenantId", "NormalizedName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateContainers_TenantId",
                schema: "performance",
                table: "ObjectiveTemplateContainers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateContainers_TenantId_Code",
                schema: "performance",
                table: "ObjectiveTemplateContainers",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateContainers_TenantId_Status",
                schema: "performance",
                table: "ObjectiveTemplateContainers",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateRevisions_CategoryId",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateRevisions_TemplateId",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateRevisions_TemplateId_Status",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                columns: new[] { "TemplateId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateRevisions_TemplateId_VersionNumber",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                columns: new[] { "TemplateId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplateRevisions_TenantId",
                schema: "performance",
                table: "ObjectiveTemplateRevisions",
                column: "TenantId");
        }
    }
}

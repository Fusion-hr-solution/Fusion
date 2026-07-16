using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    public partial class AddStarterTemplatesAndMigrateLegacy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create PlatformStarterTemplates table
            migrationBuilder.CreateTable(
                name: "PlatformStarterTemplates",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    MeasurementType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Qualitative"),
                    SuggestedWeighting = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    Tags = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TargetValue = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    Unit = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    SuccessCriteria = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformStarterTemplates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlatformStarterTemplates_IsActive",
                schema: "performance",
                table: "PlatformStarterTemplates",
                column: "IsActive");

            // 2. Migrate existing ObjectiveTemplates rows to the new stable-identity model.
            //    One container + one revision per legacy row (one-to-one).
            //    The container inherits the legacy template's Id to preserve any external references.
            migrationBuilder.Sql(@"
                INSERT INTO performance.""ObjectiveTemplateContainers"" (
                    ""Id"", ""TenantId"", ""Status"", ""CreatedAt"", ""UpdatedAt"", ""CreatedBy"", ""UpdatedBy""
                )
                SELECT
                    lt.""Id"",
                    lt.""TenantId"",
                    CASE WHEN lt.""Status"" = 'Active' THEN 'Active' ELSE 'Archived' END,
                    lt.""CreatedAt"",
                    lt.""UpdatedAt"",
                    lt.""CreatedBy"",
                    NULL
                FROM performance.""ObjectiveTemplates"" lt;
            ");

            // Insert one revision per container using the same Id mapping.
            migrationBuilder.Sql(@"
                INSERT INTO performance.""ObjectiveTemplateRevisions"" (
                    ""Id"", ""TemplateId"", ""TenantId"", ""VersionNumber"", ""Status"",
                    ""Title"", ""Description"", ""CategoryId"",
                    ""MeasurementType"", ""SuggestedWeighting"", ""Tags"",
                    ""TargetValue"", ""Unit"", ""SuccessCriteria"",
                    ""CreatedByUserId"", ""CreatedByName"",
                    ""SourceRevisionId"", ""ChangeSummary"",
                    ""ActivatedAt"", ""ActivatedByUserId"", ""ActivatedByName"",
                    ""SupersededAt"",
                    ""ApplicableOrgUnitIds"", ""ApplicableJobTitles"",
                    ""ApplicableWorkLocations"", ""ApplicableEmploymentTypes"",
                    ""ApplicabilityValidationState"",
                    ""CreatedAt"", ""UpdatedAt"", ""CreatedBy"", ""UpdatedBy""
                )
                SELECT
                    gen_random_uuid(),
                    lt.""Id"",
                    lt.""TenantId"",
                    1,
                    CASE WHEN lt.""Status"" = 'Active' THEN 'Active' ELSE 'Superseded' END,
                    lt.""Name"",
                    lt.""Description"",
                    NULL,
                    'Qualitative',
                    lt.""DefaultWeight"",
                    NULL,
                    NULL, NULL,
                    lt.""SuccessMeasure"",
                    lt.""TenantId""::text,
                    'Migration',
                    NULL, 'Migrated from legacy template model',
                    CASE WHEN lt.""Status"" = 'Active' THEN lt.""CreatedAt"" ELSE NULL END,
                    CASE WHEN lt.""Status"" = 'Active' THEN '00000000-0000-0000-0000-000000000000'::uuid ELSE NULL END,
                    CASE WHEN lt.""Status"" = 'Active' THEN 'Migration' ELSE NULL END,
                    NULL,
                    '[]', '[]', '[]', '[]',
                    'Valid',
                    lt.""CreatedAt"",
                    lt.""UpdatedAt"",
                    lt.""CreatedBy"",
                    NULL
                FROM performance.""ObjectiveTemplates"" lt;
            ");

            // 3. Initialize an Active tenant policy for every tenant that has migrated templates
            //    but no existing policy. Uses spec §7.2 baseline defaults.
            //    Tenants must have an Active policy before they can activate any template.
            migrationBuilder.Sql(@"
                WITH tenants_needing_policy AS (
                    SELECT DISTINCT c.""TenantId""
                    FROM performance.""ObjectiveTemplateContainers"" c
                    WHERE NOT EXISTS (
                        SELECT 1 FROM performance.""TenantObjectivePolicies"" tp
                        WHERE tp.""TenantId"" = c.""TenantId""
                    )
                ),
                new_policies AS (
                    INSERT INTO performance.""TenantObjectivePolicies"" (
                        ""Id"", ""TenantId"", ""CreatedAt"", ""UpdatedAt"", ""CreatedBy"", ""UpdatedBy""
                    )
                    SELECT
                        gen_random_uuid(),
                        t.""TenantId"",
                        NOW(),
                        NULL,
                        'migration',
                        NULL
                    FROM tenants_needing_policy t
                    RETURNING ""Id"" AS policy_id, ""TenantId""
                )
                INSERT INTO performance.""TenantObjectivePolicyVersions"" (
                    ""Id"", ""TenantId"", ""PolicyId"", ""VersionNumber"", ""Status"",
                    ""MaxObjectivesPerPlan"", ""AllowedWeightValues"", ""ManagerValidationSlaDays"",
                    ""CascadeMode"", ""MeasurementTypes"", ""AttachmentsEnabled"",
                    ""CreatedByUserId"", ""CreatedByName"",
                    ""SourceVersionId"", ""SourceBaselineVersionId"",
                    ""ActivatedAt"", ""ActivatedByUserId"", ""ActivatedByName"", ""ChangeSummary"",
                    ""SupersededAt"",
                    ""CreatedAt"", ""UpdatedAt"", ""CreatedBy"", ""UpdatedBy""
                )
                SELECT
                    gen_random_uuid(),
                    np.""TenantId"",
                    np.policy_id,
                    1,
                    'Active',
                    7,
                    '5,10,15,20,25,30,40,50',
                    10,
                    'Optional',
                    'Quantitative,Qualitative',
                    true,
                    '00000000-0000-0000-0000-000000000000'::uuid,
                    'Migration',
                    NULL,
                    NULL,
                    NOW(),
                    '00000000-0000-0000-0000-000000000000'::uuid,
                    'Migration',
                    'Initialized from spec §7.2 baseline defaults during P1 migration',
                    NULL,
                    NOW(),
                    NULL,
                    'migration',
                    NULL
                FROM new_policies np;
            ");

            // 4. Drop the legacy ObjectiveTemplates table.
            migrationBuilder.DropTable(
                name: "ObjectiveTemplates",
                schema: "performance");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Re-create the legacy table (empty; data migration is not reversible)
            migrationBuilder.CreateTable(
                name: "ObjectiveTemplates",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", nullable: true),
                    Category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Individual"),
                    ParentTemplateId = table.Column<Guid>(type: "uuid", nullable: true),
                    SuccessMeasure = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Target = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DefaultWeight = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Active"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveTemplates", x => x.Id);
                });

            // Restore every index created by the earlier ObjectiveTemplates migrations
            // so their Down methods can unwind the schema in reverse order.
            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplates_TenantId",
                schema: "performance",
                table: "ObjectiveTemplates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplates_TenantId_Name",
                schema: "performance",
                table: "ObjectiveTemplates",
                columns: new[] { "TenantId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplates_Tenant_Parent",
                schema: "performance",
                table: "ObjectiveTemplates",
                columns: new[] { "TenantId", "ParentTemplateId" });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveTemplates_TenantId_Status",
                schema: "performance",
                table: "ObjectiveTemplates",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.DropTable(
                name: "PlatformStarterTemplates",
                schema: "performance");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantObjectivePolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TenantObjectivePolicies",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantObjectivePolicies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TenantObjectivePolicyVersions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PolicyId = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MaxObjectivesPerPlan = table.Column<int>(type: "integer", nullable: false),
                    AllowedWeightValues = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ManagerValidationSlaDays = table.Column<int>(type: "integer", nullable: false),
                    CascadeMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MeasurementTypes = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    AttachmentsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    SourceVersionId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceBaselineVersionId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ActivatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActivatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActivatedByName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ChangeSummary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SupersededAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantObjectivePolicyVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantObjectivePolicyVersions_TenantObjectivePolicies_Polic~",
                        column: x => x.PolicyId,
                        principalSchema: "performance",
                        principalTable: "TenantObjectivePolicies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TenantObjectivePolicies_TenantId",
                schema: "performance",
                table: "TenantObjectivePolicies",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantObjectivePolicyVersions_Policy_Status",
                schema: "performance",
                table: "TenantObjectivePolicyVersions",
                columns: new[] { "PolicyId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantObjectivePolicyVersions_PolicyId",
                schema: "performance",
                table: "TenantObjectivePolicyVersions",
                column: "PolicyId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantObjectivePolicyVersions_TenantId",
                schema: "performance",
                table: "TenantObjectivePolicyVersions",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TenantObjectivePolicyVersions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "TenantObjectivePolicies",
                schema: "performance");
        }
    }
}

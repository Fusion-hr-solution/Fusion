using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCampaignWorkforceFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmployeeOrgMemberships",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeOrgMemberships", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Positions",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    Code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Positions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EmployeePositionAssignments",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PositionId = table.Column<Guid>(type: "uuid", nullable: true),
                    PositionTitle = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeePositionAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmployeePositionAssignments_Positions_PositionId",
                        column: x => x.PositionId,
                        principalSchema: "corehr",
                        principalTable: "Positions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EmployeeReportingRelationships",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ManagerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectPositionAssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ManagerPositionAssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeReportingRelationships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmployeeReportingRelationships_EmployeePositionAssignments_~",
                        column: x => x.ManagerPositionAssignmentId,
                        principalSchema: "corehr",
                        principalTable: "EmployeePositionAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmployeeReportingRelationships_EmployeePositionAssignments~1",
                        column: x => x.SubjectPositionAssignmentId,
                        principalSchema: "corehr",
                        principalTable: "EmployeePositionAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmployeeReportingRelationships_Employees_ManagerEmployeeId",
                        column: x => x.ManagerEmployeeId,
                        principalSchema: "corehr",
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmployeeReportingRelationships_Employees_SubjectEmployeeId",
                        column: x => x.SubjectEmployeeId,
                        principalSchema: "corehr",
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeOrgMemberships_TenantId_EmployeeId_IsPrimary_Effect~",
                schema: "corehr",
                table: "EmployeeOrgMemberships",
                columns: new[] { "TenantId", "EmployeeId", "IsPrimary", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeOrgMemberships_TenantId_OrgUnitId",
                schema: "corehr",
                table: "EmployeeOrgMemberships",
                columns: new[] { "TenantId", "OrgUnitId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeePositionAssignments_PositionId",
                schema: "corehr",
                table: "EmployeePositionAssignments",
                column: "PositionId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeePositionAssignments_TenantId",
                schema: "corehr",
                table: "EmployeePositionAssignments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeePositionAssignments_TenantId_EmployeeId_IsPrimary_E~",
                schema: "corehr",
                table: "EmployeePositionAssignments",
                columns: new[] { "TenantId", "EmployeeId", "IsPrimary", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeePositionAssignments_TenantId_PositionId",
                schema: "corehr",
                table: "EmployeePositionAssignments",
                columns: new[] { "TenantId", "PositionId" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeReportingRelationships_ManagerEmployeeId",
                schema: "corehr",
                table: "EmployeeReportingRelationships",
                column: "ManagerEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeReportingRelationships_ManagerPositionAssignmentId",
                schema: "corehr",
                table: "EmployeeReportingRelationships",
                column: "ManagerPositionAssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeReportingRelationships_SubjectEmployeeId",
                schema: "corehr",
                table: "EmployeeReportingRelationships",
                column: "SubjectEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeReportingRelationships_SubjectPositionAssignmentId",
                schema: "corehr",
                table: "EmployeeReportingRelationships",
                column: "SubjectPositionAssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeReportingRelationships_Tenant_Manager_Type",
                schema: "corehr",
                table: "EmployeeReportingRelationships",
                columns: new[] { "TenantId", "ManagerEmployeeId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeReportingRelationships_Tenant_Subject_Type_EffectiveFrom",
                schema: "corehr",
                table: "EmployeeReportingRelationships",
                columns: new[] { "TenantId", "SubjectEmployeeId", "Type", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_Positions_TenantId_Code",
                schema: "corehr",
                table: "Positions",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Positions_TenantId_OrgUnitId",
                schema: "corehr",
                table: "Positions",
                columns: new[] { "TenantId", "OrgUnitId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeOrgMemberships",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "EmployeeReportingRelationships",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "EmployeePositionAssignments",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "Positions",
                schema: "corehr");
        }
    }
}

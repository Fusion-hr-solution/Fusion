using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLegacyEmployeeWorkforceRuntime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Employees_Employees_ManagerId",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropForeignKey(
                name: "FK_Employees_OrgUnits_OrgUnitId",
                schema: "corehr",
                table: "Employees");

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

            migrationBuilder.DropIndex(
                name: "IX_Employees_ManagerId",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Employees_OrgUnitId",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "EmploymentType",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "HireDate",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "JobTitle",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "ManagerId",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "OrgUnitId",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "Status",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "WorkLocation",
                schema: "corehr",
                table: "Employees");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EmploymentType",
                schema: "corehr",
                table: "Employees",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "HireDate",
                schema: "corehr",
                table: "Employees",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "JobTitle",
                schema: "corehr",
                table: "Employees",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ManagerId",
                schema: "corehr",
                table: "Employees",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrgUnitId",
                schema: "corehr",
                table: "Employees",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                schema: "corehr",
                table: "Employees",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Active");

            migrationBuilder.AddColumn<string>(
                name: "WorkLocation",
                schema: "corehr",
                table: "Employees",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EmployeeOrgMemberships",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    Code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
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
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    PositionTitle = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    PositionId = table.Column<Guid>(type: "uuid", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ManagerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ManagerPositionAssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectPositionAssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
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
                name: "IX_Employees_ManagerId",
                schema: "corehr",
                table: "Employees",
                column: "ManagerId");

            migrationBuilder.CreateIndex(
                name: "IX_Employees_OrgUnitId",
                schema: "corehr",
                table: "Employees",
                column: "OrgUnitId");

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

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_Employees_ManagerId",
                schema: "corehr",
                table: "Employees",
                column: "ManagerId",
                principalSchema: "corehr",
                principalTable: "Employees",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_OrgUnits_OrgUnitId",
                schema: "corehr",
                table: "Employees",
                column: "OrgUnitId",
                principalSchema: "corehr",
                principalTable: "OrgUnits",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}

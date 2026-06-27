using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkforceCanonicalModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Employments",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EmploymentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SourceReference = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ImportBatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Employments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Employments_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "corehr",
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WorkforceAuditEntries",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntityType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Actor = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SourceReference = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ImportBatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    ChangeDetails = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkforceAuditEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WorkAssignments",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmploymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    JobTitle = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    WorkLocation = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SourceReference = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ImportBatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkAssignments_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "corehr",
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkAssignments_Employments_EmploymentId",
                        column: x => x.EmploymentId,
                        principalSchema: "corehr",
                        principalTable: "Employments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkAssignments_OrgUnits_OrgUnitId",
                        column: x => x.OrgUnitId,
                        principalSchema: "corehr",
                        principalTable: "OrgUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ManagerRelationships",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ManagerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectWorkAssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ManagerWorkAssignmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SourceReference = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ImportBatchId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ManagerRelationships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ManagerRelationships_Employees_ManagerEmployeeId",
                        column: x => x.ManagerEmployeeId,
                        principalSchema: "corehr",
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ManagerRelationships_Employees_SubjectEmployeeId",
                        column: x => x.SubjectEmployeeId,
                        principalSchema: "corehr",
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ManagerRelationships_WorkAssignments_ManagerWorkAssignmentId",
                        column: x => x.ManagerWorkAssignmentId,
                        principalSchema: "corehr",
                        principalTable: "WorkAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ManagerRelationships_WorkAssignments_SubjectWorkAssignmentId",
                        column: x => x.SubjectWorkAssignmentId,
                        principalSchema: "corehr",
                        principalTable: "WorkAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Employments_EmployeeId",
                schema: "corehr",
                table: "Employments",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "UX_Employments_TenantId_EmployeeId_Active",
                schema: "corehr",
                table: "Employments",
                columns: new[] { "TenantId", "EmployeeId" },
                unique: true,
                filter: "\"EffectiveTo\" IS NULL AND \"Status\" = 'Active'");

            migrationBuilder.CreateIndex(
                name: "IX_ManagerRelationships_ManagerEmployeeId",
                schema: "corehr",
                table: "ManagerRelationships",
                column: "ManagerEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_ManagerRelationships_ManagerWorkAssignmentId",
                schema: "corehr",
                table: "ManagerRelationships",
                column: "ManagerWorkAssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ManagerRelationships_SubjectEmployeeId",
                schema: "corehr",
                table: "ManagerRelationships",
                column: "SubjectEmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_ManagerRelationships_SubjectWorkAssignmentId",
                schema: "corehr",
                table: "ManagerRelationships",
                column: "SubjectWorkAssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ManagerRelationships_Tenant_Manager_Type",
                schema: "corehr",
                table: "ManagerRelationships",
                columns: new[] { "TenantId", "ManagerEmployeeId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_ManagerRelationships_Tenant_Subject_Type_EffectiveFrom",
                schema: "corehr",
                table: "ManagerRelationships",
                columns: new[] { "TenantId", "SubjectEmployeeId", "Type", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_ManagerRelationships_Tenant_SubjectWorkAssignment",
                schema: "corehr",
                table: "ManagerRelationships",
                columns: new[] { "TenantId", "SubjectWorkAssignmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkAssignments_EmployeeId",
                schema: "corehr",
                table: "WorkAssignments",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkAssignments_EmploymentId",
                schema: "corehr",
                table: "WorkAssignments",
                column: "EmploymentId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkAssignments_OrgUnitId",
                schema: "corehr",
                table: "WorkAssignments",
                column: "OrgUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkAssignments_TenantId_EmploymentId",
                schema: "corehr",
                table: "WorkAssignments",
                columns: new[] { "TenantId", "EmploymentId" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkAssignments_TenantId_OrgUnitId",
                schema: "corehr",
                table: "WorkAssignments",
                columns: new[] { "TenantId", "OrgUnitId" });

            migrationBuilder.CreateIndex(
                name: "UX_WorkAssignments_TenantId_EmployeeId_ActivePrimary",
                schema: "corehr",
                table: "WorkAssignments",
                columns: new[] { "TenantId", "EmployeeId" },
                unique: true,
                filter: "\"IsPrimary\" = TRUE AND \"EffectiveTo\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_WorkforceAuditEntries_Tenant_Entity",
                schema: "corehr",
                table: "WorkforceAuditEntries",
                columns: new[] { "TenantId", "EntityType", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkforceAuditEntries_Tenant_OccurredAt",
                schema: "corehr",
                table: "WorkforceAuditEntries",
                columns: new[] { "TenantId", "OccurredAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ManagerRelationships",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "WorkforceAuditEntries",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "WorkAssignments",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "Employments",
                schema: "corehr");
        }
    }
}

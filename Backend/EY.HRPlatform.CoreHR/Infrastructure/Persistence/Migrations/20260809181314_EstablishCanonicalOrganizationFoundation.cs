using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EstablishCanonicalOrganizationFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OrgUnits_TenantId_Name",
                schema: "corehr",
                table: "OrgUnits");

            migrationBuilder.AddColumn<bool>(
                name: "IsRoot",
                schema: "corehr",
                table: "OrgUnits",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "OrganizationalUnitTypes",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsBuiltIn = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NormalizedName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationalUnitTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationChanges",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Summary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    IsCancelled = table.Column<bool>(type: "boolean", nullable: false),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationChanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationChanges_OrgUnits_OrgUnitId",
                        column: x => x.OrgUnitId,
                        principalSchema: "corehr",
                        principalTable: "OrgUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrgUnitCodeReservations",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    NormalizedCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrgUnitCodeReservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrgUnitCodeReservations_OrgUnits_OrgUnitId",
                        column: x => x.OrgUnitId,
                        principalSchema: "corehr",
                        principalTable: "OrgUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrgUnitEffectiveStates",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrgUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizationalUnitTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentOrgUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LifecycleState = table.Column<int>(type: "integer", nullable: false),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrgUnitEffectiveStates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrgUnitEffectiveStates_OrgUnits_OrgUnitId",
                        column: x => x.OrgUnitId,
                        principalSchema: "corehr",
                        principalTable: "OrgUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrgUnitEffectiveStates_OrgUnits_ParentOrgUnitId",
                        column: x => x.ParentOrgUnitId,
                        principalSchema: "corehr",
                        principalTable: "OrgUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrgUnitEffectiveStates_OrganizationalUnitTypes_Organization~",
                        column: x => x.OrganizationalUnitTypeId,
                        principalSchema: "corehr",
                        principalTable: "OrganizationalUnitTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "UX_OrgUnits_TenantId_Root",
                schema: "corehr",
                table: "OrgUnits",
                columns: new[] { "TenantId", "IsRoot" },
                unique: true,
                filter: "\"IsRoot\" = true");

            migrationBuilder.CreateIndex(
                name: "UX_OrganizationalUnitTypes_BuiltIn_NormalizedName",
                schema: "corehr",
                table: "OrganizationalUnitTypes",
                columns: new[] { "IsBuiltIn", "NormalizedName" },
                unique: true,
                filter: "\"IsBuiltIn\" = true");

            migrationBuilder.CreateIndex(
                name: "UX_OrganizationalUnitTypes_TenantId_NormalizedName",
                schema: "corehr",
                table: "OrganizationalUnitTypes",
                columns: new[] { "TenantId", "NormalizedName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationChanges_OrgUnitId_EffectiveDate",
                schema: "corehr",
                table: "OrganizationChanges",
                columns: new[] { "OrgUnitId", "EffectiveDate" });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationChanges_TenantId_EffectiveDate_IsCancelled",
                schema: "corehr",
                table: "OrganizationChanges",
                columns: new[] { "TenantId", "EffectiveDate", "IsCancelled" });

            migrationBuilder.CreateIndex(
                name: "IX_OrgUnitCodeReservations_OrgUnitId",
                schema: "corehr",
                table: "OrgUnitCodeReservations",
                column: "OrgUnitId");

            migrationBuilder.CreateIndex(
                name: "UX_OrgUnitCodeReservations_TenantId_NormalizedCode",
                schema: "corehr",
                table: "OrgUnitCodeReservations",
                columns: new[] { "TenantId", "NormalizedCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrgUnitEffectiveStates_OrganizationalUnitTypeId",
                schema: "corehr",
                table: "OrgUnitEffectiveStates",
                column: "OrganizationalUnitTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_OrgUnitEffectiveStates_ParentOrgUnitId",
                schema: "corehr",
                table: "OrgUnitEffectiveStates",
                column: "ParentOrgUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_OrgUnitEffectiveStates_TenantId_EffectiveFrom",
                schema: "corehr",
                table: "OrgUnitEffectiveStates",
                columns: new[] { "TenantId", "EffectiveFrom" });

            migrationBuilder.CreateIndex(
                name: "IX_OrgUnitEffectiveStates_TenantId_ParentOrgUnitId",
                schema: "corehr",
                table: "OrgUnitEffectiveStates",
                columns: new[] { "TenantId", "ParentOrgUnitId" });

            migrationBuilder.CreateIndex(
                name: "UX_OrgUnitEffectiveStates_OrgUnitId_EffectiveFrom",
                schema: "corehr",
                table: "OrgUnitEffectiveStates",
                columns: new[] { "OrgUnitId", "EffectiveFrom" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationChanges",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "OrgUnitCodeReservations",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "OrgUnitEffectiveStates",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "OrganizationalUnitTypes",
                schema: "corehr");

            migrationBuilder.DropIndex(
                name: "UX_OrgUnits_TenantId_Root",
                schema: "corehr",
                table: "OrgUnits");

            migrationBuilder.DropColumn(
                name: "IsRoot",
                schema: "corehr",
                table: "OrgUnits");

            migrationBuilder.CreateIndex(
                name: "IX_OrgUnits_TenantId_Name",
                schema: "corehr",
                table: "OrgUnits",
                columns: new[] { "TenantId", "Name" },
                unique: true);

        }
    }
}

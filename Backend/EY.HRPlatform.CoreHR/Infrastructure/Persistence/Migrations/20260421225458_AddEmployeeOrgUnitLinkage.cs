using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeOrgUnitLinkage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OrgUnitId",
                schema: "corehr",
                table: "Employees",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Employees_OrgUnitId",
                schema: "corehr",
                table: "Employees",
                column: "OrgUnitId");

            migrationBuilder.AddForeignKey(
                name: "FK_Employees_OrgUnits_OrgUnitId",
                schema: "corehr",
                table: "Employees",
                column: "OrgUnitId",
                principalSchema: "corehr",
                principalTable: "OrgUnits",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

                        // Backfill OrgUnitId for legacy employees where Department can be
                        // resolved deterministically against the trusted live structure.
                        // Prefer code matches over name matches when both are possible.
                        migrationBuilder.Sql(
                                """
                                UPDATE corehr."Employees" AS e
                                SET "OrgUnitId" = o."Id"
                                FROM corehr."OrgUnits" AS o
                                WHERE e."OrgUnitId" IS NULL
                                    AND e."Department" IS NOT NULL
                                    AND btrim(e."Department") <> ''
                                    AND o."TenantId" = e."TenantId"
                                    AND o."IsActive" = TRUE
                                    AND upper(o."Code") = upper(btrim(e."Department"));
                                """);

                        migrationBuilder.Sql(
                                """
                                UPDATE corehr."Employees" AS e
                                SET "OrgUnitId" = o."Id"
                                FROM corehr."OrgUnits" AS o
                                WHERE e."OrgUnitId" IS NULL
                                    AND e."Department" IS NOT NULL
                                    AND btrim(e."Department") <> ''
                                    AND o."TenantId" = e."TenantId"
                                    AND o."IsActive" = TRUE
                                    AND lower(o."Name") = lower(btrim(e."Department"))
                                    AND NOT EXISTS (
                                            SELECT 1
                                            FROM corehr."OrgUnits" AS code_match
                                            WHERE code_match."TenantId" = e."TenantId"
                                                AND code_match."IsActive" = TRUE
                                                AND upper(code_match."Code") = upper(btrim(e."Department"))
                                    );
                                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Employees_OrgUnits_OrgUnitId",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Employees_OrgUnitId",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "OrgUnitId",
                schema: "corehr",
                table: "Employees");
        }
    }
}

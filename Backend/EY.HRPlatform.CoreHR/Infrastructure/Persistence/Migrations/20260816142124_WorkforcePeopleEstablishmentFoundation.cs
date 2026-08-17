using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WorkforcePeopleEstablishmentFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Employees_TenantId_Email",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.DropIndex(
                name: "IX_Employees_TenantId_EmployeeNumber",
                schema: "corehr",
                table: "Employees");

            migrationBuilder.Sql(
                """
                UPDATE corehr."Employees"
                SET "EmployeeNumber" = upper(btrim("EmployeeNumber"))
                WHERE "EmployeeNumber" IS NOT NULL;

                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM corehr."Employees"
                        WHERE "EmployeeNumber" IS NULL OR btrim("EmployeeNumber") = '') THEN
                        RAISE EXCEPTION 'Workforce Slice 1 migration requires a clean reset or an operator-approved Employee Number remediation before constraint tightening.';
                    END IF;

                    IF EXISTS (
                        SELECT 1
                        FROM corehr."Employees"
                        GROUP BY "TenantId", "EmployeeNumber"
                        HAVING count(*) > 1) THEN
                        RAISE EXCEPTION 'Workforce Slice 1 migration found duplicate normalized Employee Numbers.';
                    END IF;
                END $$;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "EmployeeNumber",
                schema: "corehr",
                table: "Employees",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                schema: "corehr",
                table: "Employees",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(256)",
                oldMaxLength: 256);

            migrationBuilder.Sql(
                """
                UPDATE corehr."Employees"
                SET "Email" = NULLIF(lower(btrim("Email")), '')
                WHERE "Email" IS NOT NULL;
                """);

            migrationBuilder.CreateTable(
                name: "EmployeeNumberAllocators",
                schema: "corehr",
                columns: table => new
                {
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    NextValue = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeNumberAllocators", x => x.TenantId);
                    table.CheckConstraint("CK_EmployeeNumberAllocators_NextValue_Positive", "\"NextValue\" > 0");
                });

            migrationBuilder.CreateTable(
                name: "WorkEmailOccupancies",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkEmailOccupancies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkEmailOccupancies_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "corehr",
                        principalTable: "Employees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Employees_TenantId_EmployeeNumber",
                schema: "corehr",
                table: "Employees",
                columns: new[] { "TenantId", "EmployeeNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkEmailOccupancies_EmployeeId",
                schema: "corehr",
                table: "WorkEmailOccupancies",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "UX_WorkEmailOccupancies_TenantId_EmployeeId",
                schema: "corehr",
                table: "WorkEmailOccupancies",
                columns: new[] { "TenantId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_WorkEmailOccupancies_TenantId_NormalizedEmail",
                schema: "corehr",
                table: "WorkEmailOccupancies",
                columns: new[] { "TenantId", "NormalizedEmail" },
                unique: true);

            migrationBuilder.Sql(
                """
                INSERT INTO corehr."WorkEmailOccupancies"
                    ("Id", "TenantId", "EmployeeId", "NormalizedEmail", "CreatedAt")
                SELECT gen_random_uuid(), e."TenantId", e."Id", e."Email", now()
                FROM corehr."Employees" e
                WHERE e."Email" IS NOT NULL
                  AND EXISTS (
                      SELECT 1
                      FROM corehr."Employments" employment
                      WHERE employment."TenantId" = e."TenantId"
                        AND employment."EmployeeId" = e."Id"
                        AND employment."Status" = 'Active'
                        AND employment."EffectiveTo" IS NULL)
                ORDER BY e."TenantId", e."Id";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException(
                "Workforce People establishment persistence is forward-only. " +
                "Reverting nullable email or required Employee Number semantics could invalidate committed workforce truth.");
        }
    }
}

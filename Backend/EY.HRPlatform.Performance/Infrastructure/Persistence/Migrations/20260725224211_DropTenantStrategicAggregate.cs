using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropTenantStrategicAggregate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Precondition, not an assumption: the tenant strategic library was never reachable —
            // no UI, and no access-profile template granted strategic.manage or strategic.publish —
            // so these tables are expected to be empty. If an environment proves otherwise, this
            // fails loudly rather than silently destroying rows nobody knew existed.
            migrationBuilder.Sql("""
                DO $$
                DECLARE
                    objective_count bigint;
                    period_count bigint;
                BEGIN
                    SELECT COUNT(*) INTO objective_count FROM performance."StrategicObjectives";
                    SELECT COUNT(*) INTO period_count FROM performance."StrategicPeriods";

                    IF objective_count > 0 OR period_count > 0 THEN
                        RAISE EXCEPTION
                            'Refusing to drop the tenant strategic tables: % objective(s) and % period(s) present. Review and clear this data before migrating.',
                            objective_count, period_count;
                    END IF;
                END $$;
                """);

            migrationBuilder.DropTable(
                name: "StrategicObjectives",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "StrategicPeriods",
                schema: "performance");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StrategicObjectives",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    OrgScope = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PeriodId = table.Column<Guid>(type: "uuid", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SupersededById = table.Column<Guid>(type: "uuid", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StrategicObjectives", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StrategicPeriods",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FiscalYear = table.Column<int>(type: "integer", nullable: false),
                    Granularity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Label = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StrategicPeriods", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StrategicObjectives_Tenant_Period_Scope_Status",
                schema: "performance",
                table: "StrategicObjectives",
                columns: new[] { "TenantId", "PeriodId", "OrgScope", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_StrategicPeriods_Tenant_FiscalYear_Granularity",
                schema: "performance",
                table: "StrategicPeriods",
                columns: new[] { "TenantId", "FiscalYear", "Granularity" });
        }
    }
}

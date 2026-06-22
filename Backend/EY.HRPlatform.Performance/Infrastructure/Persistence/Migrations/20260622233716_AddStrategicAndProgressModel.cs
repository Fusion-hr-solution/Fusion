using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStrategicAndProgressModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ApprovalDelegates",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    DelegatorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    DelegateEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ValidFrom = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ValidUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApprovalDelegates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ObjectiveProgressEntries",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Mode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PreviousPercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    NewPercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    Comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveProgressEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StrategicObjectives",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    PeriodId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrgScope = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    SupersededById = table.Column<Guid>(type: "uuid", nullable: true),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
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
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    Label = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FiscalYear = table.Column<int>(type: "integer", nullable: false),
                    Granularity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StrategicPeriods", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalDelegates_Tenant_Cycle_Active",
                schema: "performance",
                table: "ApprovalDelegates",
                columns: new[] { "TenantId", "CycleId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_ApprovalDelegates_Tenant_Cycle_Delegator",
                schema: "performance",
                table: "ApprovalDelegates",
                columns: new[] { "TenantId", "CycleId", "DelegatorEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveProgressEntries_Tenant_Objective",
                schema: "performance",
                table: "ObjectiveProgressEntries",
                columns: new[] { "TenantId", "ObjectiveId" });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveProgressEntries_Tenant_OccurredAt",
                schema: "performance",
                table: "ObjectiveProgressEntries",
                columns: new[] { "TenantId", "OccurredAt" });

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

            // D-03 / T-03-09: Exactly one Published version per tenant + org scope + period.
            // A filtered (partial) unique index enforces this at the DB layer, complementing
            // the domain guard and optimistic concurrency so two concurrent publishes cannot
            // both become "current Published".
            migrationBuilder.Sql(@"
                CREATE UNIQUE INDEX ""UIX_StrategicObjectives_OnePublished_Per_Tenant_Scope_Period""
                ON performance.""StrategicObjectives"" (""TenantId"", ""OrgScope"", ""PeriodId"")
                WHERE ""Status"" = 'Published';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP INDEX IF EXISTS performance.""UIX_StrategicObjectives_OnePublished_Per_Tenant_Scope_Period"";");

            migrationBuilder.DropTable(
                name: "ApprovalDelegates",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ObjectiveProgressEntries",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "StrategicObjectives",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "StrategicPeriods",
                schema: "performance");
        }
    }
}

using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CoreHRDbContext))]
[Migration("20260922143000_AddOrganizationImportMappingPlan")]
public sealed class AddOrganizationImportMappingPlan : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
        => migrationBuilder.AddColumn<string>(
            name: "AppliedMappingPlanJson",
            schema: "corehr",
            table: "OrganizationImportSessions",
            type: "jsonb",
            nullable: true);

    protected override void Down(MigrationBuilder migrationBuilder)
        => migrationBuilder.DropColumn(
            name: "AppliedMappingPlanJson",
            schema: "corehr",
            table: "OrganizationImportSessions");
}

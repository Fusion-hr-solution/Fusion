using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PerformanceDbContext))]
[Migration("20260621153000_AddCampaignGovernanceAndLaunchSnapshots")]
public partial class AddCampaignGovernanceAndLaunchSnapshots : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(name: "RetentionPolicyVersionId", schema: "performance", table: "PerformanceCycles", type: "uuid", nullable: true);
        migrationBuilder.AddColumn<bool>(name: "RequireTeamObjectiveSuperiorApproval", schema: "performance", table: "PerformanceCycles", type: "boolean", nullable: false, defaultValue: false);
        migrationBuilder.AddColumn<int>(name: "MinimumAnonymousFeedbackResponses", schema: "performance", table: "PerformanceCycles", type: "integer", nullable: false, defaultValue: 3);
        migrationBuilder.AddColumn<string>(name: "FeedbackVisibility", schema: "performance", table: "PerformanceCycles", type: "character varying(40)", maxLength: 40, nullable: false, defaultValue: "AnonymousToSubject");
        migrationBuilder.AddColumn<Guid>(name: "FrozenRetentionPolicyVersionId", schema: "performance", table: "PerformanceCycles", type: "uuid", nullable: true);
        migrationBuilder.AddColumn<bool>(name: "FrozenRequireTeamObjectiveSuperiorApproval", schema: "performance", table: "PerformanceCycles", type: "boolean", nullable: true);
        migrationBuilder.AddColumn<int>(name: "FrozenMinimumAnonymousFeedbackResponses", schema: "performance", table: "PerformanceCycles", type: "integer", nullable: true);
        migrationBuilder.AddColumn<string>(name: "FrozenFeedbackVisibility", schema: "performance", table: "PerformanceCycles", type: "character varying(40)", maxLength: 40, nullable: true);
        migrationBuilder.AddColumn<DateTime>(name: "GovernanceFrozenAt", schema: "performance", table: "PerformanceCycles", type: "timestamp with time zone", nullable: true);

        migrationBuilder.CreateTable(
            name: "CampaignExceptionOwners", schema: "performance",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                Priority = table.Column<int>(type: "integer", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                CreatedBy = table.Column<string>(type: "text", nullable: true),
                UpdatedBy = table.Column<string>(type: "text", nullable: true)
            }, constraints: table => table.PrimaryKey("PK_CampaignExceptionOwners", x => x.Id));
        migrationBuilder.CreateIndex(name: "IX_CampaignExceptionOwners_CycleId_EmployeeId", schema: "performance", table: "CampaignExceptionOwners", columns: new[] { "CycleId", "EmployeeId" }, unique: true);
        migrationBuilder.CreateIndex(name: "IX_CampaignExceptionOwners_CycleId_Priority", schema: "performance", table: "CampaignExceptionOwners", columns: new[] { "CycleId", "Priority" }, unique: true);
        migrationBuilder.CreateIndex(name: "IX_CampaignExceptionOwners_TenantId", schema: "performance", table: "CampaignExceptionOwners", column: "TenantId");

        migrationBuilder.CreateTable(
            name: "CampaignLaunchParticipantSnapshots", schema: "performance",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false), TenantId = table.Column<Guid>(type: "uuid", nullable: false), CycleId = table.Column<Guid>(type: "uuid", nullable: false), EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                FullName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false), EmployeeKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true), Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                OrgUnitId = table.Column<Guid>(type: "uuid", nullable: true), OrgUnitName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true), JobTitle = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                PrimaryManagerId = table.Column<Guid>(type: "uuid", nullable: true), PrimaryManagerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true), FrozenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false), UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true), CreatedBy = table.Column<string>(type: "text", nullable: true), UpdatedBy = table.Column<string>(type: "text", nullable: true)
            }, constraints: table => table.PrimaryKey("PK_CampaignLaunchParticipantSnapshots", x => x.Id));
        migrationBuilder.CreateIndex(name: "IX_CampaignLaunchParticipantSnapshots_CycleId_EmployeeId", schema: "performance", table: "CampaignLaunchParticipantSnapshots", columns: new[] { "CycleId", "EmployeeId" }, unique: true);
        migrationBuilder.CreateIndex(name: "IX_CampaignLaunchParticipantSnapshots_TenantId", schema: "performance", table: "CampaignLaunchParticipantSnapshots", column: "TenantId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "CampaignExceptionOwners", schema: "performance");
        migrationBuilder.DropTable(name: "CampaignLaunchParticipantSnapshots", schema: "performance");
        foreach (var column in new[] { "RetentionPolicyVersionId", "RequireTeamObjectiveSuperiorApproval", "MinimumAnonymousFeedbackResponses", "FeedbackVisibility", "FrozenRetentionPolicyVersionId", "FrozenRequireTeamObjectiveSuperiorApproval", "FrozenMinimumAnonymousFeedbackResponses", "FrozenFeedbackVisibility", "GovernanceFrozenAt" })
            migrationBuilder.DropColumn(name: column, schema: "performance", table: "PerformanceCycles");
    }
}

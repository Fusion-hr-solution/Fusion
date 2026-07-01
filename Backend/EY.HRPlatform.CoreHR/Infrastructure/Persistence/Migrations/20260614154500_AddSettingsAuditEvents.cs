using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSettingsAuditEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SettingsAuditEvents",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ActorRole = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SectionId = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Action = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ResourceType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ResourceId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    BeforeJson = table.Column<string>(type: "jsonb", nullable: true),
                    AfterJson = table.Column<string>(type: "jsonb", nullable: true),
                    CorrelationId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SettingsAuditEvents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SettingsAuditEvents_TenantId_OccurredAt",
                schema: "corehr",
                table: "SettingsAuditEvents",
                columns: ["TenantId", "OccurredAt"]);

            migrationBuilder.CreateIndex(
                name: "IX_SettingsAuditEvents_TenantId_SectionId_OccurredAt",
                schema: "corehr",
                table: "SettingsAuditEvents",
                columns: ["TenantId", "SectionId", "OccurredAt"]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SettingsAuditEvents",
                schema: "corehr");
        }
    }
}

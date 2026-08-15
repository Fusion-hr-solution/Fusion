using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationImportSemanticAssistance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrganizationImportSemanticAttempts",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    AttemptOrdinal = table.Column<int>(type: "integer", nullable: false),
                    ContractVersion = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    InputFingerprint = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Model = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    EligibleIssueKeysJson = table.Column<string>(type: "jsonb", nullable: false),
                    SuggestionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    ReviewOutcomesJson = table.Column<string>(type: "jsonb", nullable: true),
                    FailureCategory = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: true),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RetryAfter = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LatencyMilliseconds = table.Column<int>(type: "integer", nullable: true),
                    InputTokens = table.Column<int>(type: "integer", nullable: true),
                    OutputTokens = table.Column<int>(type: "integer", nullable: true),
                    AppliedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    AppliedByDisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationImportSemanticAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationImportSemanticAttempts_OrganizationImportSessio~",
                        column: x => x.SessionId,
                        principalSchema: "corehr",
                        principalTable: "OrganizationImportSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationImportSemanticAttempts_SessionId",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationImportSemanticAttempts_Tenant_Session_Status",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                columns: new[] { "TenantId", "SessionId", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_OrganizationImportSemanticAttempts_Tenant_Session_Fingerprint_Ordinal",
                schema: "corehr",
                table: "OrganizationImportSemanticAttempts",
                columns: new[] { "TenantId", "SessionId", "InputFingerprint", "AttemptOrdinal" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationImportSemanticAttempts",
                schema: "corehr");
        }
    }
}

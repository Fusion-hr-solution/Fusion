using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.CoreHR.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkforceImportEstablishment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WorkforceImportHistories",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    BaselineDate = table.Column<DateOnly>(type: "date", nullable: false),
                    SourceFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorDisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CommittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AddedEmployeeCount = table.Column<int>(type: "integer", nullable: false),
                    ExistingAnchorCount = table.Column<int>(type: "integer", nullable: false),
                    ExcludedCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedEmployeeKeysJson = table.Column<string>(type: "jsonb", nullable: false),
                    MappingResolutionSummaryJson = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkforceImportHistories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WorkforceImportSessions",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    BaselineDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CreationToken = table.Column<Guid>(type: "uuid", nullable: false),
                    CreationFingerprint = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SelectedSheetName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    StartedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartedByDisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    LastUpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LastUpdatedByDisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    DecisionsJson = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    DecisionRevision = table.Column<int>(type: "integer", nullable: false),
                    DecisionsUpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecisionsUpdatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    DecisionsUpdatedByDisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NewCount = table.Column<int>(type: "integer", nullable: false),
                    ExistingAnchorCount = table.Column<int>(type: "integer", nullable: false),
                    NeedsAttentionCount = table.Column<int>(type: "integer", nullable: false),
                    ExcludedCount = table.Column<int>(type: "integer", nullable: false),
                    ReviewDigest = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CanonicalObservationDigest = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PayloadPurgedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DiscardedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DiscardedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ExpiredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AppliedStartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CommittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CommittedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CommittedByDisplayName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    FinalSemanticDigest = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CommitResultJson = table.Column<string>(type: "jsonb", nullable: true),
                    FinalProvenanceJson = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkforceImportSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WorkforceImportRows",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceRowNumber = table.Column<int>(type: "integer", nullable: false),
                    SourceCellsJson = table.Column<string>(type: "jsonb", nullable: true),
                    NormalizedProposalJson = table.Column<string>(type: "jsonb", nullable: true),
                    CandidateEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedOrgUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedManagerKey = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Classification = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    IssueStateJson = table.Column<string>(type: "jsonb", nullable: true),
                    IsExcluded = table.Column<bool>(type: "boolean", nullable: false),
                    DecisionRefsJson = table.Column<string>(type: "jsonb", nullable: true),
                    PayloadPurgedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkforceImportRows", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkforceImportRows_WorkforceImportSessions_SessionId",
                        column: x => x.SessionId,
                        principalSchema: "corehr",
                        principalTable: "WorkforceImportSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkforceImportSources",
                schema: "corehr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    OriginalFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    SourceFormat = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ByteLength = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SelectedSheetName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    SelectedRange = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ColumnCount = table.Column<int>(type: "integer", nullable: false),
                    RowCount = table.Column<int>(type: "integer", nullable: false),
                    ColumnsJson = table.Column<string>(type: "jsonb", nullable: true),
                    RawBytes = table.Column<byte[]>(type: "bytea", nullable: true),
                    PayloadPurgedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkforceImportSources", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkforceImportSources_WorkforceImportSessions_SessionId",
                        column: x => x.SessionId,
                        principalSchema: "corehr",
                        principalTable: "WorkforceImportSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkforceImportHistories_Tenant_CommittedAt",
                schema: "corehr",
                table: "WorkforceImportHistories",
                columns: new[] { "TenantId", "CommittedAt" });

            migrationBuilder.CreateIndex(
                name: "UX_WorkforceImportHistories_Tenant_Session",
                schema: "corehr",
                table: "WorkforceImportHistories",
                columns: new[] { "TenantId", "SessionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkforceImportRows_SessionId",
                schema: "corehr",
                table: "WorkforceImportRows",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkforceImportRows_Tenant_Session_Classification",
                schema: "corehr",
                table: "WorkforceImportRows",
                columns: new[] { "TenantId", "SessionId", "Classification" });

            migrationBuilder.CreateIndex(
                name: "UX_WorkforceImportRows_Tenant_Session_SourceRowNumber",
                schema: "corehr",
                table: "WorkforceImportRows",
                columns: new[] { "TenantId", "SessionId", "SourceRowNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkforceImportSessions_Tenant_Status_ExpiresAt",
                schema: "corehr",
                table: "WorkforceImportSessions",
                columns: new[] { "TenantId", "Status", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkforceImportSessions_Tenant_Status_UpdatedAt",
                schema: "corehr",
                table: "WorkforceImportSessions",
                columns: new[] { "TenantId", "Status", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "UX_WorkforceImportSessions_Tenant_ActiveSingleton",
                schema: "corehr",
                table: "WorkforceImportSessions",
                column: "TenantId",
                unique: true,
                filter: "\"Status\" IN ('Intake','Interpreting','Reviewing','Ready','Applying')");

            migrationBuilder.CreateIndex(
                name: "UX_WorkforceImportSessions_Tenant_CreationToken",
                schema: "corehr",
                table: "WorkforceImportSessions",
                columns: new[] { "TenantId", "CreationToken" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkforceImportSources_SessionId",
                schema: "corehr",
                table: "WorkforceImportSources",
                column: "SessionId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkforceImportSources_TenantId",
                schema: "corehr",
                table: "WorkforceImportSources",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WorkforceImportHistories",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "WorkforceImportRows",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "WorkforceImportSources",
                schema: "corehr");

            migrationBuilder.DropTable(
                name: "WorkforceImportSessions",
                schema: "corehr");
        }
    }
}

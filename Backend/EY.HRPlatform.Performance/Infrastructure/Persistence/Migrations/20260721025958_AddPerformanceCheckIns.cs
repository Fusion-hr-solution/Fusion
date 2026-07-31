using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceCheckIns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ObjectiveDiscussionSignals",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    RaisedByEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveTitle = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    LinkedCheckInId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedByCheckInId = table.Column<Guid>(type: "uuid", nullable: true),
                    CloseReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RaisedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObjectiveDiscussionSignals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ObjectiveDiscussionSignals_EmployeeObjectivePlans_PlanId",
                        column: x => x.PlanId,
                        principalSchema: "performance",
                        principalTable: "EmployeeObjectivePlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceCheckIns",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByReviewerId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByReviewerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ReviewerRelationship = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PlannedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PlannedTime = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Agenda = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CompletionSummary = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    CompletedByReviewerId = table.Column<Guid>(type: "uuid", nullable: true),
                    CompletedByReviewerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancellationReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CancelledByReviewerId = table.Column<Guid>(type: "uuid", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceCheckIns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformanceCheckIns_PerformanceCycles_CycleId",
                        column: x => x.CycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CheckInFollowUpActions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    CheckInId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    OwnerKind = table.Column<int>(type: "integer", nullable: false),
                    OwnerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LinkedObjectiveId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    ResolutionNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CheckInFollowUpActions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CheckInFollowUpActions_PerformanceCheckIns_CheckInId",
                        column: x => x.CheckInId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCheckIns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceCheckInAddenda",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CheckInId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorReviewerId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceCheckInAddenda", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformanceCheckInAddenda_PerformanceCheckIns_CheckInId",
                        column: x => x.CheckInId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCheckIns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceCheckInLinkedObjectives",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CheckInId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: false),
                    ObjectiveTitle = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    WasDiscussed = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceCheckInLinkedObjectives", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformanceCheckInLinkedObjectives_PerformanceCheckIns_Chec~",
                        column: x => x.CheckInId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCheckIns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceCheckInRescheduleEntries",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CheckInId = table.Column<Guid>(type: "uuid", nullable: false),
                    PreviousDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PreviousTime = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    NewDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NewTime = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    ActorReviewerId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceCheckInRescheduleEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformanceCheckInRescheduleEntries_PerformanceCheckIns_Che~",
                        column: x => x.CheckInId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCheckIns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PerformanceCheckInResponses",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CheckInId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformanceCheckInResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformanceCheckInResponses_PerformanceCheckIns_CheckInId",
                        column: x => x.CheckInId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCheckIns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CheckInFollowUpActionStatusEvents",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActionId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromStatus = table.Column<int>(type: "integer", nullable: false),
                    ToStatus = table.Column<int>(type: "integer", nullable: false),
                    ActorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CheckInFollowUpActionStatusEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CheckInFollowUpActionStatusEvents_CheckInFollowUpActions_Ac~",
                        column: x => x.ActionId,
                        principalSchema: "performance",
                        principalTable: "CheckInFollowUpActions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CheckInFollowUpActions_CheckIn",
                schema: "performance",
                table: "CheckInFollowUpActions",
                column: "CheckInId");

            migrationBuilder.CreateIndex(
                name: "IX_CheckInFollowUpActions_Tenant_Cycle_Employee_Status",
                schema: "performance",
                table: "CheckInFollowUpActions",
                columns: new[] { "TenantId", "CycleId", "EmployeeId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_CheckInFollowUpActions_Tenant_Owner_Status_Due",
                schema: "performance",
                table: "CheckInFollowUpActions",
                columns: new[] { "TenantId", "OwnerEmployeeId", "Status", "DueDate" });

            migrationBuilder.CreateIndex(
                name: "IX_CheckInFollowUpActionStatusEvents_Action_OccurredAt",
                schema: "performance",
                table: "CheckInFollowUpActionStatusEvents",
                columns: new[] { "ActionId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveDiscussionSignals_LinkedCheckIn",
                schema: "performance",
                table: "ObjectiveDiscussionSignals",
                column: "LinkedCheckInId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveDiscussionSignals_PlanId",
                schema: "performance",
                table: "ObjectiveDiscussionSignals",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveDiscussionSignals_Tenant_Cycle_Employee_Status",
                schema: "performance",
                table: "ObjectiveDiscussionSignals",
                columns: new[] { "TenantId", "CycleId", "RaisedByEmployeeId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ObjectiveDiscussionSignals_Tenant_Cycle_Objective_Status",
                schema: "performance",
                table: "ObjectiveDiscussionSignals",
                columns: new[] { "TenantId", "CycleId", "ObjectiveId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCheckInAddenda_CheckIn_CreatedAt",
                schema: "performance",
                table: "PerformanceCheckInAddenda",
                columns: new[] { "CheckInId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCheckInLinkedObjectives_CheckIn_Objective",
                schema: "performance",
                table: "PerformanceCheckInLinkedObjectives",
                columns: new[] { "CheckInId", "ObjectiveId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCheckInRescheduleEntries_CheckIn_OccurredAt",
                schema: "performance",
                table: "PerformanceCheckInRescheduleEntries",
                columns: new[] { "CheckInId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCheckInResponses_CheckIn",
                schema: "performance",
                table: "PerformanceCheckInResponses",
                column: "CheckInId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCheckIns_CycleId",
                schema: "performance",
                table: "PerformanceCheckIns",
                column: "CycleId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCheckIns_Tenant_Cycle_Employee_Status",
                schema: "performance",
                table: "PerformanceCheckIns",
                columns: new[] { "TenantId", "CycleId", "EmployeeId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCheckIns_Tenant_Employee_Status",
                schema: "performance",
                table: "PerformanceCheckIns",
                columns: new[] { "TenantId", "EmployeeId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCheckIns_Tenant_Status_PlannedDate",
                schema: "performance",
                table: "PerformanceCheckIns",
                columns: new[] { "TenantId", "Status", "PlannedDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CheckInFollowUpActionStatusEvents",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ObjectiveDiscussionSignals",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceCheckInAddenda",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceCheckInLinkedObjectives",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceCheckInRescheduleEntries",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceCheckInResponses",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "CheckInFollowUpActions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PerformanceCheckIns",
                schema: "performance");
        }
    }
}

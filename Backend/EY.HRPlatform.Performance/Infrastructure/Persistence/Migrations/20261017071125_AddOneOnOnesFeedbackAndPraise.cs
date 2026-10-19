using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOneOnOnesFeedbackAndPraise : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DefaultOneOnOneCadence",
                schema: "performance",
                table: "CycleSettings",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "EveryTwoWeeks");

            migrationBuilder.CreateTable(
                name: "Feedback",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ReceiverEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReceiverName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Visibility = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AddressedManagerEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    AddressedManagerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SubjectKind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: true),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: true),
                    ObjectiveTitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CompetencyId = table.Column<Guid>(type: "uuid", nullable: true),
                    Message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: true),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Feedback", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackRequests",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequesterEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequesterName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Question = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    SubjectKind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: true),
                    ObjectiveId = table.Column<Guid>(type: "uuid", nullable: true),
                    ObjectiveTitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CompetencyId = table.Column<Guid>(type: "uuid", nullable: true),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CloseReason = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OneOnOneSeries",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ManagerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ManagerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ReportEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Cadence = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StartedByEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndReason = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OneOnOneSeries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Praise",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CompetencyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    GivenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedByEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedByRole = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Praise", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackRequestInvitees",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeclineReason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    FeedbackId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackRequestInvitees", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackRequestInvitees_FeedbackRequests_RequestId",
                        column: x => x.RequestId,
                        principalSchema: "performance",
                        principalTable: "FeedbackRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OneOnOneActionItems",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SeriesId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OwnerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedByEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedInMeetingId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoneAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DoneInMeetingId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OneOnOneActionItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OneOnOneActionItems_OneOnOneSeries_SeriesId",
                        column: x => x.SeriesId,
                        principalSchema: "performance",
                        principalTable: "OneOnOneSeries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OneOnOneMeetings",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SeriesId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedByEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    NextMeetingId = table.Column<Guid>(type: "uuid", nullable: true),
                    SharedNotes = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    SharedNotesRevision = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OneOnOneMeetings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OneOnOneMeetings_OneOnOneSeries_SeriesId",
                        column: x => x.SeriesId,
                        principalSchema: "performance",
                        principalTable: "OneOnOneSeries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PraiseReactions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PraiseId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReactorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PraiseReactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PraiseReactions_Praise_PraiseId",
                        column: x => x.PraiseId,
                        principalSchema: "performance",
                        principalTable: "Praise",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PraiseRecipients",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PraiseId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PraiseRecipients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PraiseRecipients_Praise_PraiseId",
                        column: x => x.PraiseId,
                        principalSchema: "performance",
                        principalTable: "Praise",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OneOnOneAgendaItems",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    AuthorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    DiscussedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SourceKind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SourceId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceCycleId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OneOnOneAgendaItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OneOnOneAgendaItems_OneOnOneMeetings_MeetingId",
                        column: x => x.MeetingId,
                        principalSchema: "performance",
                        principalTable: "OneOnOneMeetings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OneOnOnePrivateNotes",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    Revision = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OneOnOnePrivateNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OneOnOnePrivateNotes_OneOnOneMeetings_MeetingId",
                        column: x => x.MeetingId,
                        principalSchema: "performance",
                        principalTable: "OneOnOneMeetings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_RequestId",
                schema: "performance",
                table: "Feedback",
                column: "RequestId");

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_TenantId_AddressedManagerEmployeeId",
                schema: "performance",
                table: "Feedback",
                columns: new[] { "TenantId", "AddressedManagerEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_TenantId_AuthorEmployeeId_SentAt",
                schema: "performance",
                table: "Feedback",
                columns: new[] { "TenantId", "AuthorEmployeeId", "SentAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_TenantId_ObjectiveId",
                schema: "performance",
                table: "Feedback",
                columns: new[] { "TenantId", "ObjectiveId" });

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_TenantId_ReceiverEmployeeId_SentAt",
                schema: "performance",
                table: "Feedback",
                columns: new[] { "TenantId", "ReceiverEmployeeId", "SentAt" });

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackRequestInvitees_RequestId_EmployeeId",
                schema: "performance",
                table: "FeedbackRequestInvitees",
                columns: new[] { "RequestId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackRequestInvitees_TenantId_EmployeeId_Status",
                schema: "performance",
                table: "FeedbackRequestInvitees",
                columns: new[] { "TenantId", "EmployeeId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackRequests_TenantId_RequesterEmployeeId_RequestedAt",
                schema: "performance",
                table: "FeedbackRequests",
                columns: new[] { "TenantId", "RequesterEmployeeId", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneActionItems_SeriesId",
                schema: "performance",
                table: "OneOnOneActionItems",
                column: "SeriesId");

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneActionItems_TenantId_OwnerEmployeeId",
                schema: "performance",
                table: "OneOnOneActionItems",
                columns: new[] { "TenantId", "OwnerEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneAgendaItems_MeetingId",
                schema: "performance",
                table: "OneOnOneAgendaItems",
                column: "MeetingId");

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneMeetings_SeriesId_ScheduledAt",
                schema: "performance",
                table: "OneOnOneMeetings",
                columns: new[] { "SeriesId", "ScheduledAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneMeetings_TenantId",
                schema: "performance",
                table: "OneOnOneMeetings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOnePrivateNotes_MeetingId_AuthorEmployeeId",
                schema: "performance",
                table: "OneOnOnePrivateNotes",
                columns: new[] { "MeetingId", "AuthorEmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneSeries_ActivePair",
                schema: "performance",
                table: "OneOnOneSeries",
                columns: new[] { "TenantId", "ManagerEmployeeId", "ReportEmployeeId" },
                unique: true,
                filter: "\"EndedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneSeries_TenantId_ManagerEmployeeId",
                schema: "performance",
                table: "OneOnOneSeries",
                columns: new[] { "TenantId", "ManagerEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_OneOnOneSeries_TenantId_ReportEmployeeId",
                schema: "performance",
                table: "OneOnOneSeries",
                columns: new[] { "TenantId", "ReportEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_Praise_TenantId_AuthorEmployeeId",
                schema: "performance",
                table: "Praise",
                columns: new[] { "TenantId", "AuthorEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_Praise_TenantId_GivenAt",
                schema: "performance",
                table: "Praise",
                columns: new[] { "TenantId", "GivenAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PraiseReactions_PraiseId_ReactorEmployeeId_Kind",
                schema: "performance",
                table: "PraiseReactions",
                columns: new[] { "PraiseId", "ReactorEmployeeId", "Kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PraiseRecipients_PraiseId_EmployeeId",
                schema: "performance",
                table: "PraiseRecipients",
                columns: new[] { "PraiseId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PraiseRecipients_TenantId_EmployeeId",
                schema: "performance",
                table: "PraiseRecipients",
                columns: new[] { "TenantId", "EmployeeId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Feedback",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FeedbackRequestInvitees",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "OneOnOneActionItems",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "OneOnOneAgendaItems",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "OneOnOnePrivateNotes",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PraiseReactions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PraiseRecipients",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "FeedbackRequests",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "OneOnOneMeetings",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "Praise",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "OneOnOneSeries",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "DefaultOneOnOneCadence",
                schema: "performance",
                table: "CycleSettings");
        }
    }
}

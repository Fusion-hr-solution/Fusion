using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReviewPeersQuestionsAndRelease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AcknowledgementReminderDays",
                schema: "performance",
                table: "ReviewRounds",
                type: "integer",
                nullable: false,
                defaultValue: 7);

            migrationBuilder.AddColumn<int>(
                name: "ManagerAssessmentDueDays",
                schema: "performance",
                table: "ReviewRounds",
                type: "integer",
                nullable: false,
                defaultValue: 7);

            migrationBuilder.AddColumn<DateOnly>(
                name: "PeerInputDueDate",
                schema: "performance",
                table: "ReviewRounds",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PeerInputDueDays",
                schema: "performance",
                table: "ReviewRounds",
                type: "integer",
                nullable: false,
                defaultValue: 14);

            migrationBuilder.AddColumn<bool>(
                name: "PeerInputEnabled",
                schema: "performance",
                table: "ReviewRounds",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PotentialEnabled",
                schema: "performance",
                table: "ReviewRounds",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "QuestionsEnabled",
                schema: "performance",
                table: "ReviewRounds",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "SelfAssessmentDueDays",
                schema: "performance",
                table: "ReviewRounds",
                type: "integer",
                nullable: false,
                defaultValue: 14);

            migrationBuilder.AddColumn<DateTime>(
                name: "AcknowledgedAt",
                schema: "performance",
                table: "PerformanceReviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AcknowledgementComment",
                schema: "performance",
                table: "PerformanceReviews",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ManagerDueOverridden",
                schema: "performance",
                table: "PerformanceReviews",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PeerInputEnabled",
                schema: "performance",
                table: "PerformanceReviews",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "PeerListApprovedAt",
                schema: "performance",
                table: "PerformanceReviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PeerListApprovedByEmployeeId",
                schema: "performance",
                table: "PerformanceReviews",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PeersNominatedAt",
                schema: "performance",
                table: "PerformanceReviews",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Potential",
                schema: "performance",
                table: "PerformanceReviews",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PotentialEnabled",
                schema: "performance",
                table: "PerformanceReviews",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "QuestionsEnabled",
                schema: "performance",
                table: "PerformanceReviews",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateOnly>(
                name: "SelfAssessmentDueDate",
                schema: "performance",
                table: "PerformanceReviews",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SelfDueOverridden",
                schema: "performance",
                table: "PerformanceReviews",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "AcknowledgementReminderDays",
                schema: "performance",
                table: "CycleSettings",
                type: "integer",
                nullable: false,
                defaultValue: 7);

            migrationBuilder.AddColumn<int>(
                name: "ManagerAssessmentDueDays",
                schema: "performance",
                table: "CycleSettings",
                type: "integer",
                nullable: false,
                defaultValue: 7);

            migrationBuilder.AddColumn<int>(
                name: "PeerInputDueDays",
                schema: "performance",
                table: "CycleSettings",
                type: "integer",
                nullable: false,
                defaultValue: 14);

            migrationBuilder.AddColumn<int>(
                name: "SelfAssessmentDueDays",
                schema: "performance",
                table: "CycleSettings",
                type: "integer",
                nullable: false,
                defaultValue: 14);

            // Reviews opened before this change read their self-assessment date from the round.
            migrationBuilder.Sql("""
                UPDATE performance."PerformanceReviews" r SET "SelfAssessmentDueDate" = rr."SelfAssessmentDueDate"
                FROM performance."ReviewRounds" rr
                WHERE r."ReviewRoundId" = rr."Id" AND r."SelfAssessmentEnabled";
                """);

            migrationBuilder.CreateTable(
                name: "PeerNominations",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    NominatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PeerNominations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PeerNominations_PerformanceReviews_ReviewId",
                        column: x => x.ReviewId,
                        principalSchema: "performance",
                        principalTable: "PerformanceReviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PeerRequests",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewRoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    PeerEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PeerDisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectDisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeclineNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PeerRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PeerRequests_PerformanceReviews_ReviewId",
                        column: x => x.ReviewId,
                        principalSchema: "performance",
                        principalTable: "PerformanceReviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PeerRequests_ReviewRounds_ReviewRoundId",
                        column: x => x.ReviewRoundId,
                        principalSchema: "performance",
                        principalTable: "ReviewRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReviewDueDateMoves",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewRoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewId = table.Column<Guid>(type: "uuid", nullable: true),
                    SubjectDisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Stage = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    FromDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ToDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ActorEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    MovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AffectedCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewDueDateMoves", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewDueDateMoves_PerformanceReviews_ReviewId",
                        column: x => x.ReviewId,
                        principalSchema: "performance",
                        principalTable: "PerformanceReviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReviewDueDateMoves_ReviewRounds_ReviewRoundId",
                        column: x => x.ReviewRoundId,
                        principalSchema: "performance",
                        principalTable: "ReviewRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReviewQuestions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Audience = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FirstUsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewQuestions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ReviewQuestionSnapshots",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewRoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Audience = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewQuestionSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewQuestionSnapshots_ReviewRounds_ReviewRoundId",
                        column: x => x.ReviewRoundId,
                        principalSchema: "performance",
                        principalTable: "ReviewRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReviewRoundQuestions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewRoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Audience = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewRoundQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewRoundQuestions_ReviewQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalSchema: "performance",
                        principalTable: "ReviewQuestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReviewRoundQuestions_ReviewRounds_ReviewRoundId",
                        column: x => x.ReviewRoundId,
                        principalSchema: "performance",
                        principalTable: "ReviewRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PeerAnswers",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PeerRequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PeerAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PeerAnswers_PeerRequests_PeerRequestId",
                        column: x => x.PeerRequestId,
                        principalSchema: "performance",
                        principalTable: "PeerRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PeerAnswers_ReviewQuestionSnapshots_QuestionSnapshotId",
                        column: x => x.QuestionSnapshotId,
                        principalSchema: "performance",
                        principalTable: "ReviewQuestionSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReviewQuestionAnswers",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionSnapshotId = table.Column<Guid>(type: "uuid", nullable: false),
                    Author = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewQuestionAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewQuestionAnswers_PerformanceReviews_ReviewId",
                        column: x => x.ReviewId,
                        principalSchema: "performance",
                        principalTable: "PerformanceReviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ReviewQuestionAnswers_ReviewQuestionSnapshots_QuestionSnaps~",
                        column: x => x.QuestionSnapshotId,
                        principalSchema: "performance",
                        principalTable: "ReviewQuestionSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PeerAnswers_PeerRequestId",
                schema: "performance",
                table: "PeerAnswers",
                column: "PeerRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_PeerAnswers_QuestionSnapshotId",
                schema: "performance",
                table: "PeerAnswers",
                column: "QuestionSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_PeerAnswers_TenantId",
                schema: "performance",
                table: "PeerAnswers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PeerAnswers_TenantId_PeerRequestId_QuestionSnapshotId",
                schema: "performance",
                table: "PeerAnswers",
                columns: new[] { "TenantId", "PeerRequestId", "QuestionSnapshotId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PeerNominations_ReviewId",
                schema: "performance",
                table: "PeerNominations",
                column: "ReviewId");

            migrationBuilder.CreateIndex(
                name: "IX_PeerNominations_TenantId",
                schema: "performance",
                table: "PeerNominations",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PeerNominations_TenantId_ReviewId_EmployeeId",
                schema: "performance",
                table: "PeerNominations",
                columns: new[] { "TenantId", "ReviewId", "EmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PeerRequests_ReviewId",
                schema: "performance",
                table: "PeerRequests",
                column: "ReviewId");

            migrationBuilder.CreateIndex(
                name: "IX_PeerRequests_ReviewRoundId",
                schema: "performance",
                table: "PeerRequests",
                column: "ReviewRoundId");

            migrationBuilder.CreateIndex(
                name: "IX_PeerRequests_TenantId",
                schema: "performance",
                table: "PeerRequests",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PeerRequests_TenantId_PeerEmployeeId_State",
                schema: "performance",
                table: "PeerRequests",
                columns: new[] { "TenantId", "PeerEmployeeId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_PeerRequests_TenantId_ReviewId_PeerEmployeeId",
                schema: "performance",
                table: "PeerRequests",
                columns: new[] { "TenantId", "ReviewId", "PeerEmployeeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PeerRequests_TenantId_ReviewRoundId_State",
                schema: "performance",
                table: "PeerRequests",
                columns: new[] { "TenantId", "ReviewRoundId", "State" });

            migrationBuilder.CreateIndex(
                name: "IX_ReviewDueDateMoves_ReviewId",
                schema: "performance",
                table: "ReviewDueDateMoves",
                column: "ReviewId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewDueDateMoves_ReviewRoundId",
                schema: "performance",
                table: "ReviewDueDateMoves",
                column: "ReviewRoundId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewDueDateMoves_TenantId",
                schema: "performance",
                table: "ReviewDueDateMoves",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewDueDateMoves_TenantId_ReviewRoundId_MovedAt",
                schema: "performance",
                table: "ReviewDueDateMoves",
                columns: new[] { "TenantId", "ReviewRoundId", "MovedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ReviewQuestionAnswers_QuestionSnapshotId",
                schema: "performance",
                table: "ReviewQuestionAnswers",
                column: "QuestionSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewQuestionAnswers_ReviewId",
                schema: "performance",
                table: "ReviewQuestionAnswers",
                column: "ReviewId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewQuestionAnswers_TenantId",
                schema: "performance",
                table: "ReviewQuestionAnswers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewQuestionAnswers_TenantId_ReviewId_QuestionSnapshotId_~",
                schema: "performance",
                table: "ReviewQuestionAnswers",
                columns: new[] { "TenantId", "ReviewId", "QuestionSnapshotId", "Author" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReviewQuestions_TenantId",
                schema: "performance",
                table: "ReviewQuestions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewQuestions_TenantId_Audience_SortOrder",
                schema: "performance",
                table: "ReviewQuestions",
                columns: new[] { "TenantId", "Audience", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ReviewQuestionSnapshots_ReviewRoundId",
                schema: "performance",
                table: "ReviewQuestionSnapshots",
                column: "ReviewRoundId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewQuestionSnapshots_TenantId",
                schema: "performance",
                table: "ReviewQuestionSnapshots",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewQuestionSnapshots_TenantId_ReviewRoundId_QuestionId",
                schema: "performance",
                table: "ReviewQuestionSnapshots",
                columns: new[] { "TenantId", "ReviewRoundId", "QuestionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRoundQuestions_QuestionId",
                schema: "performance",
                table: "ReviewRoundQuestions",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRoundQuestions_ReviewRoundId",
                schema: "performance",
                table: "ReviewRoundQuestions",
                column: "ReviewRoundId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRoundQuestions_TenantId",
                schema: "performance",
                table: "ReviewRoundQuestions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRoundQuestions_TenantId_ReviewRoundId_QuestionId",
                schema: "performance",
                table: "ReviewRoundQuestions",
                columns: new[] { "TenantId", "ReviewRoundId", "QuestionId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PeerAnswers",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PeerNominations",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ReviewDueDateMoves",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ReviewQuestionAnswers",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ReviewRoundQuestions",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "PeerRequests",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ReviewQuestionSnapshots",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ReviewQuestions",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "AcknowledgementReminderDays",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropColumn(
                name: "ManagerAssessmentDueDays",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropColumn(
                name: "PeerInputDueDate",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropColumn(
                name: "PeerInputDueDays",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropColumn(
                name: "PeerInputEnabled",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropColumn(
                name: "PotentialEnabled",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropColumn(
                name: "QuestionsEnabled",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropColumn(
                name: "SelfAssessmentDueDays",
                schema: "performance",
                table: "ReviewRounds");

            migrationBuilder.DropColumn(
                name: "AcknowledgedAt",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "AcknowledgementComment",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "ManagerDueOverridden",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "PeerInputEnabled",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "PeerListApprovedAt",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "PeerListApprovedByEmployeeId",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "PeersNominatedAt",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "Potential",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "PotentialEnabled",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "QuestionsEnabled",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SelfAssessmentDueDate",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "SelfDueOverridden",
                schema: "performance",
                table: "PerformanceReviews");

            migrationBuilder.DropColumn(
                name: "AcknowledgementReminderDays",
                schema: "performance",
                table: "CycleSettings");

            migrationBuilder.DropColumn(
                name: "ManagerAssessmentDueDays",
                schema: "performance",
                table: "CycleSettings");

            migrationBuilder.DropColumn(
                name: "PeerInputDueDays",
                schema: "performance",
                table: "CycleSettings");

            migrationBuilder.DropColumn(
                name: "SelfAssessmentDueDays",
                schema: "performance",
                table: "CycleSettings");
        }
    }
}

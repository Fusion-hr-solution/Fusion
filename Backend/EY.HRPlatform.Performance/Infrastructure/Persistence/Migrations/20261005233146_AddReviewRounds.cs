using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReviewRounds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ReviewRounds",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PeriodStart = table.Column<DateOnly>(type: "date", nullable: false),
                    PeriodEnd = table.Column<DateOnly>(type: "date", nullable: false),
                    SelfAssessmentEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ObjectiveRatingsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    CalibrationEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    SelfAssessmentDueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ManagerAssessmentDueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CompetencyIdsJson = table.Column<string>(type: "jsonb", nullable: false),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ActiveCycleSlot = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewRounds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewRounds_PerformanceCycles_CycleId",
                        column: x => x.CycleId,
                        principalSchema: "performance",
                        principalTable: "PerformanceCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReviewRoundSubjects",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewRoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParticipantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectDisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ReviewerEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewerDisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ReviewerBasis = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IsExcluded = table.Column<bool>(type: "boolean", nullable: false),
                    ExclusionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReviewRoundSubjects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReviewRoundSubjects_Participants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalSchema: "performance",
                        principalTable: "Participants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReviewRoundSubjects_ReviewRounds_ReviewRoundId",
                        column: x => x.ReviewRoundId,
                        principalSchema: "performance",
                        principalTable: "ReviewRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRounds_ActiveCycleSlot",
                schema: "performance",
                table: "ReviewRounds",
                column: "ActiveCycleSlot",
                unique: true,
                filter: "\"ActiveCycleSlot\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRounds_CycleId",
                schema: "performance",
                table: "ReviewRounds",
                column: "CycleId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRounds_TenantId",
                schema: "performance",
                table: "ReviewRounds",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRounds_TenantId_CycleId",
                schema: "performance",
                table: "ReviewRounds",
                columns: new[] { "TenantId", "CycleId" });

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRoundSubjects_ParticipantId",
                schema: "performance",
                table: "ReviewRoundSubjects",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRoundSubjects_ReviewRoundId",
                schema: "performance",
                table: "ReviewRoundSubjects",
                column: "ReviewRoundId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRoundSubjects_TenantId",
                schema: "performance",
                table: "ReviewRoundSubjects",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRoundSubjects_TenantId_ReviewRoundId_ParticipantId",
                schema: "performance",
                table: "ReviewRoundSubjects",
                columns: new[] { "TenantId", "ReviewRoundId", "ParticipantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReviewRoundSubjects_TenantId_ReviewRoundId_SubjectEmployeeId",
                schema: "performance",
                table: "ReviewRoundSubjects",
                columns: new[] { "TenantId", "ReviewRoundId", "SubjectEmployeeId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReviewRoundSubjects",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "ReviewRounds",
                schema: "performance");
        }
    }
}

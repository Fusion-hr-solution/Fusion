using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCalibrationSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CalibrationSessions",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewRoundId = table.Column<Guid>(type: "uuid", nullable: false),
                    CycleId = table.Column<Guid>(type: "uuid", nullable: false),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OpenedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FinalizedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    FinalizedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReadyNotifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalibrationSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalibrationSessions_ReviewRounds_ReviewRoundId",
                        column: x => x.ReviewRoundId,
                        principalSchema: "performance",
                        principalTable: "ReviewRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CalibrationFacilitators",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    DisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    NamedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    NamedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalibrationFacilitators", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalibrationFacilitators_CalibrationSessions_SessionId",
                        column: x => x.SessionId,
                        principalSchema: "performance",
                        principalTable: "CalibrationSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalibrationSubjects",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewId = table.Column<Guid>(type: "uuid", nullable: false),
                    OriginalRating = table.Column<int>(type: "integer", nullable: false),
                    CalibratedRating = table.Column<int>(type: "integer", nullable: true),
                    Rationale = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    DiscussionState = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalibrationSubjects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalibrationSubjects_CalibrationSessions_SessionId",
                        column: x => x.SessionId,
                        principalSchema: "performance",
                        principalTable: "CalibrationSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CalibrationSubjects_PerformanceReviews_ReviewId",
                        column: x => x.ReviewId,
                        principalSchema: "performance",
                        principalTable: "PerformanceReviews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CalibrationAdjustments",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorDisplayName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PreviousRating = table.Column<int>(type: "integer", nullable: false),
                    NewRating = table.Column<int>(type: "integer", nullable: false),
                    Rationale = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalibrationAdjustments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalibrationAdjustments_CalibrationSubjects_SubjectId",
                        column: x => x.SubjectId,
                        principalSchema: "performance",
                        principalTable: "CalibrationSubjects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationAdjustments_SubjectId_At",
                schema: "performance",
                table: "CalibrationAdjustments",
                columns: new[] { "SubjectId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationAdjustments_TenantId",
                schema: "performance",
                table: "CalibrationAdjustments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationFacilitators_SessionId_UserId",
                schema: "performance",
                table: "CalibrationFacilitators",
                columns: new[] { "SessionId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationFacilitators_TenantId",
                schema: "performance",
                table: "CalibrationFacilitators",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationSessions_ReviewRoundId",
                schema: "performance",
                table: "CalibrationSessions",
                column: "ReviewRoundId");

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationSessions_TenantId",
                schema: "performance",
                table: "CalibrationSessions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationSessions_TenantId_ReviewRoundId",
                schema: "performance",
                table: "CalibrationSessions",
                columns: new[] { "TenantId", "ReviewRoundId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationSubjects_ReviewId",
                schema: "performance",
                table: "CalibrationSubjects",
                column: "ReviewId");

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationSubjects_SessionId_ReviewId",
                schema: "performance",
                table: "CalibrationSubjects",
                columns: new[] { "SessionId", "ReviewId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CalibrationSubjects_TenantId",
                schema: "performance",
                table: "CalibrationSubjects",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CalibrationAdjustments",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "CalibrationFacilitators",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "CalibrationSubjects",
                schema: "performance");

            migrationBuilder.DropTable(
                name: "CalibrationSessions",
                schema: "performance");
        }
    }
}

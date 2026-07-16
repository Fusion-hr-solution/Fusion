using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class P15PlanApprovalReview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE performance."EmployeeObjectivePlans"
                    ALTER COLUMN "Status" DROP DEFAULT;

                ALTER TABLE performance."EmployeeObjectivePlans"
                    ALTER COLUMN "Status" TYPE integer
                    USING CASE "Status"
                        WHEN 'Draft' THEN 0
                        WHEN 'Submitted' THEN 1
                        ELSE 0
                    END;

                ALTER TABLE performance."EmployeeObjectivePlans"
                    ALTER COLUMN "Status" SET DEFAULT 0;
                """);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                schema: "performance",
                table: "EmployeeObjectivePlans",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovingManagerEmployeeId",
                schema: "performance",
                table: "EmployeeObjectivePlans",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovingManagerName",
                schema: "performance",
                table: "EmployeeObjectivePlans",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EmployeeObjectivePlanReviewEvents",
                schema: "performance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    UpdatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeObjectivePlanReviewEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmployeeObjectivePlanReviewEvents_EmployeeObjectivePlans_Pl~",
                        column: x => x.PlanId,
                        principalSchema: "performance",
                        principalTable: "EmployeeObjectivePlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeObjectivePlanReviewEvents_Plan",
                schema: "performance",
                table: "EmployeeObjectivePlanReviewEvents",
                column: "PlanId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeObjectivePlanReviewEvents_Plan_OccurredAt",
                schema: "performance",
                table: "EmployeeObjectivePlanReviewEvents",
                columns: new[] { "PlanId", "OccurredAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmployeeObjectivePlanReviewEvents",
                schema: "performance");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                schema: "performance",
                table: "EmployeeObjectivePlans");

            migrationBuilder.DropColumn(
                name: "ApprovingManagerEmployeeId",
                schema: "performance",
                table: "EmployeeObjectivePlans");

            migrationBuilder.DropColumn(
                name: "ApprovingManagerName",
                schema: "performance",
                table: "EmployeeObjectivePlans");

            migrationBuilder.Sql(
                """
                ALTER TABLE performance."EmployeeObjectivePlans"
                    ALTER COLUMN "Status" DROP DEFAULT;

                ALTER TABLE performance."EmployeeObjectivePlans"
                    ALTER COLUMN "Status" TYPE character varying(20)
                    USING CASE "Status"
                        WHEN 0 THEN 'Draft'
                        WHEN 1 THEN 'Submitted'
                        WHEN 2 THEN 'ChangesRequested'
                        WHEN 3 THEN 'Approved'
                        ELSE 'Draft'
                    END;

                ALTER TABLE performance."EmployeeObjectivePlans"
                    ALTER COLUMN "Status" SET DEFAULT 'Draft';
                """);
        }
    }
}

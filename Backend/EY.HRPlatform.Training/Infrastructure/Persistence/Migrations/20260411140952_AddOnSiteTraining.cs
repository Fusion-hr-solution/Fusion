using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOnSiteTraining : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ScheduledDate",
                schema: "training",
                table: "Trainings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TrainingType",
                schema: "training",
                table: "Trainings",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "ELearning");

            migrationBuilder.CreateTable(
                name: "OnSiteCourses",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    ContentUri = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    TrainingId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OnSiteCourses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OnSiteCourses_Trainings_TrainingId",
                        column: x => x.TrainingId,
                        principalSchema: "training",
                        principalTable: "Trainings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OnSiteCourses_TrainingId_OrderIndex",
                schema: "training",
                table: "OnSiteCourses",
                columns: new[] { "TrainingId", "OrderIndex" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OnSiteCourses",
                schema: "training");

            migrationBuilder.DropColumn(
                name: "ScheduledDate",
                schema: "training",
                table: "Trainings");

            migrationBuilder.DropColumn(
                name: "TrainingType",
                schema: "training",
                table: "Trainings");
        }
    }
}

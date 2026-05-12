using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddTrainingPartsAndSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TrainingParts",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    DurationHours = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    TrainingId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingParts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrainingParts_Trainings_TrainingId",
                        column: x => x.TrainingId,
                        principalSchema: "training",
                        principalTable: "Trainings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrainingSessions",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PartId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Room = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    MaxCapacity = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    TrainerEmployeeId = table.Column<Guid>(type: "uuid", nullable: true),
                    TrainerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    TrainerEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CancelReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrainingSessions_TrainingParts_PartId",
                        column: x => x.PartId,
                        principalSchema: "training",
                        principalTable: "TrainingParts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TrainingParts_TrainingId_OrderIndex",
                schema: "training",
                table: "TrainingParts",
                columns: new[] { "TrainingId", "OrderIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrainingSessions_PartId_StartUtc",
                schema: "training",
                table: "TrainingSessions",
                columns: new[] { "PartId", "StartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_TrainingSessions_Room_StartUtc",
                schema: "training",
                table: "TrainingSessions",
                columns: new[] { "Room", "StartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_TrainingSessions_TrainerEmployeeId",
                schema: "training",
                table: "TrainingSessions",
                column: "TrainerEmployeeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrainingSessions",
                schema: "training");

            migrationBuilder.DropTable(
                name: "TrainingParts",
                schema: "training");
        }
    }
}

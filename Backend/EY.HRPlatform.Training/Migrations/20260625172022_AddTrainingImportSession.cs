using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddTrainingImportSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TrainingImportSessions",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByEmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingImportSessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TrainingImportSessions_CreatedByEmployeeId",
                schema: "training",
                table: "TrainingImportSessions",
                column: "CreatedByEmployeeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrainingImportSessions",
                schema: "training");
        }
    }
}

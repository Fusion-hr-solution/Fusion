using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddGradeServiceLineCurriculum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Grades",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Level = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Icon = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Grades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ServiceLines",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsSharedAcrossAllServiceLines = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceLines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CurriculumMappings",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GradeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrainingId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CurriculumMappings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CurriculumMappings_Grades_GradeId",
                        column: x => x.GradeId,
                        principalSchema: "training",
                        principalTable: "Grades",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CurriculumMappings_ServiceLines_ServiceLineId",
                        column: x => x.ServiceLineId,
                        principalSchema: "training",
                        principalTable: "ServiceLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CurriculumMappings_Trainings_TrainingId",
                        column: x => x.TrainingId,
                        principalSchema: "training",
                        principalTable: "Trainings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EmployeeProfiles",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    GradeId = table.Column<Guid>(type: "uuid", nullable: true),
                    ServiceLineId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmployeeProfiles_Grades_GradeId",
                        column: x => x.GradeId,
                        principalSchema: "training",
                        principalTable: "Grades",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmployeeProfiles_ServiceLines_ServiceLineId",
                        column: x => x.ServiceLineId,
                        principalSchema: "training",
                        principalTable: "ServiceLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CurriculumMappings_GradeId_ServiceLineId_OrderIndex",
                schema: "training",
                table: "CurriculumMappings",
                columns: new[] { "GradeId", "ServiceLineId", "OrderIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CurriculumMappings_GradeId_ServiceLineId_TrainingId",
                schema: "training",
                table: "CurriculumMappings",
                columns: new[] { "GradeId", "ServiceLineId", "TrainingId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CurriculumMappings_ServiceLineId",
                schema: "training",
                table: "CurriculumMappings",
                column: "ServiceLineId");

            migrationBuilder.CreateIndex(
                name: "IX_CurriculumMappings_TrainingId",
                schema: "training",
                table: "CurriculumMappings",
                column: "TrainingId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeProfiles_EmployeeId",
                schema: "training",
                table: "EmployeeProfiles",
                column: "EmployeeId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeProfiles_GradeId",
                schema: "training",
                table: "EmployeeProfiles",
                column: "GradeId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeProfiles_ServiceLineId",
                schema: "training",
                table: "EmployeeProfiles",
                column: "ServiceLineId");

            migrationBuilder.CreateIndex(
                name: "IX_Grades_Level",
                schema: "training",
                table: "Grades",
                column: "Level");

            migrationBuilder.CreateIndex(
                name: "IX_Grades_Name",
                schema: "training",
                table: "Grades",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceLines_Code",
                schema: "training",
                table: "ServiceLines",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceLines_Name",
                schema: "training",
                table: "ServiceLines",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CurriculumMappings",
                schema: "training");

            migrationBuilder.DropTable(
                name: "EmployeeProfiles",
                schema: "training");

            migrationBuilder.DropTable(
                name: "Grades",
                schema: "training");

            migrationBuilder.DropTable(
                name: "ServiceLines",
                schema: "training");
        }
    }
}

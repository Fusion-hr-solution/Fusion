using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Training.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalTrainingBudgetAndCosts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Column adds on EXISTING tables are idempotent to tolerate a shared dev DB that may
            // already carry these columns from a parallel feature branch (mirrors AddNamedCertification).
            migrationBuilder.Sql(
                "ALTER TABLE training.\"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"ExternalTrainerCost\" numeric(18,2) NULL;");
            migrationBuilder.Sql(
                "ALTER TABLE training.\"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"VenueCost\" numeric(18,2) NULL;");
            migrationBuilder.Sql(
                "ALTER TABLE training.\"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"MaterialsCost\" numeric(18,2) NULL;");
            migrationBuilder.Sql(
                "ALTER TABLE training.\"TrainingSessions\" ADD COLUMN IF NOT EXISTS \"OtherCost\" numeric(18,2) NULL;");
            migrationBuilder.Sql(
                "ALTER TABLE training.\"Trainings\" ADD COLUMN IF NOT EXISTS \"CostType\" character varying(20) NOT NULL DEFAULT 'Internal';");
            migrationBuilder.Sql(
                "ALTER TABLE training.\"Trainings\" ADD COLUMN IF NOT EXISTS \"SponsoringServiceLineId\" uuid NULL;");

            // New table — safe to create normally (no parallel branch owns it).
            migrationBuilder.CreateTable(
                name: "TrainingBudgets",
                schema: "training",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    PeriodType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PeriodStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PeriodEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AllocatedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingBudgets", x => x.Id);
                });

            migrationBuilder.Sql(
                "CREATE INDEX IF NOT EXISTS \"IX_Trainings_SponsoringServiceLineId\" ON training.\"Trainings\" (\"SponsoringServiceLineId\");");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingBudgets_ServiceLineId",
                schema: "training",
                table: "TrainingBudgets",
                column: "ServiceLineId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingBudgets_ServiceLineId_PeriodStart",
                schema: "training",
                table: "TrainingBudgets",
                columns: new[] { "ServiceLineId", "PeriodStart" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrainingBudgets",
                schema: "training");

            migrationBuilder.Sql(
                "DROP INDEX IF EXISTS training.\"IX_Trainings_SponsoringServiceLineId\";");

            migrationBuilder.Sql("ALTER TABLE training.\"TrainingSessions\" DROP COLUMN IF EXISTS \"ExternalTrainerCost\";");
            migrationBuilder.Sql("ALTER TABLE training.\"TrainingSessions\" DROP COLUMN IF EXISTS \"VenueCost\";");
            migrationBuilder.Sql("ALTER TABLE training.\"TrainingSessions\" DROP COLUMN IF EXISTS \"MaterialsCost\";");
            migrationBuilder.Sql("ALTER TABLE training.\"TrainingSessions\" DROP COLUMN IF EXISTS \"OtherCost\";");
            migrationBuilder.Sql("ALTER TABLE training.\"Trainings\" DROP COLUMN IF EXISTS \"CostType\";");
            migrationBuilder.Sql("ALTER TABLE training.\"Trainings\" DROP COLUMN IF EXISTS \"SponsoringServiceLineId\";");
        }
    }
}

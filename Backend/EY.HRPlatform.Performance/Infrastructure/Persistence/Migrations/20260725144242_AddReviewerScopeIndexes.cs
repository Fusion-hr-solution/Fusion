using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReviewerScopeIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PerformanceCycleApproverReassignments_CycleId_ParticipantEm~",
                schema: "performance",
                table: "PerformanceCycleApproverReassignments");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCycleParticipants_Cycle_Approver",
                schema: "performance",
                table: "PerformanceCycleParticipants",
                columns: new[] { "CycleId", "ApproverEmployeeId" });

            migrationBuilder.CreateIndex(
                name: "IX_ApproverReassignments_Cycle_Participant_Time",
                schema: "performance",
                table: "PerformanceCycleApproverReassignments",
                columns: new[] { "CycleId", "ParticipantEmployeeId", "ReassignedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PerformanceCycleParticipants_Cycle_Approver",
                schema: "performance",
                table: "PerformanceCycleParticipants");

            migrationBuilder.DropIndex(
                name: "IX_ApproverReassignments_Cycle_Participant_Time",
                schema: "performance",
                table: "PerformanceCycleApproverReassignments");

            migrationBuilder.CreateIndex(
                name: "IX_PerformanceCycleApproverReassignments_CycleId_ParticipantEm~",
                schema: "performance",
                table: "PerformanceCycleApproverReassignments",
                columns: new[] { "CycleId", "ParticipantEmployeeId" });
        }
    }
}

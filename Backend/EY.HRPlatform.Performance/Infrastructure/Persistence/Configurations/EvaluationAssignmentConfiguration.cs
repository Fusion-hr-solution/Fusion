using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class EvaluationAssignmentConfiguration : IEntityTypeConfiguration<EvaluationAssignment>
{
    public void Configure(EntityTypeBuilder<EvaluationAssignment> builder)
    {
        builder.ToTable("EvaluationAssignments");
        builder.HasKey(assignment => assignment.Id);
        builder.Property(assignment => assignment.Version).IsRowVersion();
        builder.Property(assignment => assignment.TenantId).IsRequired();
        builder.Property(assignment => assignment.RoundId).IsRequired();
        builder.Property(assignment => assignment.RoundParticipantId).IsRequired();
        builder.Property(assignment => assignment.ParticipantEmployeeId).IsRequired();
        builder.Property(assignment => assignment.ParticipantName).HasMaxLength(256).IsRequired();
        builder.Property(assignment => assignment.Kind).HasConversion<string>().HasMaxLength(24).IsRequired();
        builder.Property(assignment => assignment.AssigneeEmployeeId).IsRequired();
        builder.Property(assignment => assignment.AssigneeName).HasMaxLength(256).IsRequired();
        builder.Property(assignment => assignment.Status)
            .HasConversion<string>()
            .HasMaxLength(24)
            .HasDefaultValue(EvaluationAssignmentStatus.NotStarted)
            .IsRequired();
        builder.HasOne<EvaluationRound>()
            .WithMany()
            .HasForeignKey(assignment => assignment.RoundId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<EvaluationRoundParticipant>()
            .WithMany()
            .HasForeignKey(assignment => assignment.RoundParticipantId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(assignment => new
        {
            assignment.TenantId,
            assignment.RoundId,
            assignment.ParticipantEmployeeId,
            assignment.Kind
        }).IsUnique().HasDatabaseName("UX_EvaluationAssignments_Tenant_Round_Participant_Kind");
        builder.HasIndex(assignment => new { assignment.TenantId, assignment.RoundId, assignment.Status });
        builder.HasIndex(assignment => new { assignment.TenantId, assignment.ParticipantEmployeeId, assignment.Status });
        builder.HasIndex(assignment => new { assignment.TenantId, assignment.AssigneeEmployeeId, assignment.Status });
        builder.Ignore(assignment => assignment.DomainEvents);
    }
}

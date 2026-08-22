using EY.HRPlatform.Performance.Domain.Population;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class ParticipantConfiguration : IEntityTypeConfiguration<Participant>
{
    public void Configure(EntityTypeBuilder<Participant> builder)
    {
        builder.ToTable("Participants");
        builder.HasKey(participant => participant.Id);

        builder.Property(participant => participant.DisplayName).IsRequired().HasMaxLength(300);
        builder.Property(participant => participant.JobTitle).HasMaxLength(300);
        builder.Property(participant => participant.OrgUnitName).HasMaxLength(300);
        builder.Property(participant => participant.ManagerDisplayName).HasMaxLength(300);

        builder.HasIndex(participant => participant.TenantId);

        // One participant per employee per Cycle.
        builder.HasIndex(participant => new { participant.CycleId, participant.EmployeeId }).IsUnique();
    }
}

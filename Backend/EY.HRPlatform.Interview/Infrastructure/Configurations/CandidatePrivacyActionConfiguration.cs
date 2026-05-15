using EY.HRPlatform.Interview.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class CandidatePrivacyActionConfiguration : IEntityTypeConfiguration<CandidatePrivacyAction>
{
    public void Configure(EntityTypeBuilder<CandidatePrivacyAction> builder)
    {
        builder.ToTable("CandidatePrivacyActions");
        builder.HasKey(x => x.Id);

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.UpdatedBy);

        builder.Property(x => x.TestId)
            .IsRequired();

        builder.Property(x => x.InvitationId)
            .IsRequired();

        builder.Property(x => x.ActionType)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(x => x.TriggerSource)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(x => x.AdminId)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.CandidateEmailHash)
            .IsRequired()
            .HasMaxLength(128);

        builder.Property(x => x.CandidateAliasEmail)
            .IsRequired()
            .HasMaxLength(320);

        builder.Property(x => x.CandidateAliasName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.InvitationsUpdated)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.AttemptsUpdated)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.EventsUpdated)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);

        builder.HasIndex(x => x.TestId);
        builder.HasIndex(x => x.InvitationId);
        builder.HasIndex(x => x.CandidateEmailHash);
    }
}

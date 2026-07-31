using EY.HRPlatform.Interview.Domain;
using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Models.Candidates;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Interview.Infrastructure.Configurations;

public class CandidateProctoringEventConfiguration : IEntityTypeConfiguration<CandidateProctoringEvent>
{
    public void Configure(EntityTypeBuilder<CandidateProctoringEvent> builder)
    {
        builder.ToTable("CandidateProctoringEvents");
        builder.HasKey(x => x.Id);

        builder.Ignore(x => x.CreatedBy);
        builder.Ignore(x => x.UpdatedBy);

        builder.Property(x => x.Type)
            .IsRequired()
            .HasMaxLength(ProctoringEventTypes.MaxTypeLength);

        builder.Property(x => x.Confidence);

        builder.Property(x => x.Detail)
            .HasMaxLength(ProctoringIngestLimits.MaxDetailLength);

        builder.Property(x => x.StartedAtUtc)
            .IsRequired();

        builder.Property(x => x.EndedAtUtc);

        builder.Property(x => x.ServerReceivedAtUtc)
            .IsRequired();

        builder.Property(x => x.ClientEventId)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.UpdatedAt).IsRequired(false);

        builder.HasIndex(x => x.AttemptId);
        // Idempotency: a re-sent batch (at-least-once delivery) can't create duplicate rows.
        builder.HasIndex(x => new { x.AttemptId, x.ClientEventId }).IsUnique();

        // Cascade-delete with the attempt: the parent attempt carries the identifiers, so when it
        // is hard-deleted (retention/GDPR) these metadata rows go with it automatically.
        builder.HasOne(x => x.Attempt)
            .WithMany()
            .HasForeignKey(x => x.AttemptId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

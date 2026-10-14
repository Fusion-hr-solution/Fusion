using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Reviews;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class CalibrationSessionConfiguration : IEntityTypeConfiguration<CalibrationSession>
{
    public void Configure(EntityTypeBuilder<CalibrationSession> builder)
    {
        builder.ToTable("CalibrationSessions");
        builder.HasKey(session => session.Id);
        builder.Property(session => session.Version).IsRowVersion();
        builder.Property(session => session.State).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(session => session.TenantId);
        // One session per round, enforced by the database rather than request timing.
        builder.HasIndex(session => new { session.TenantId, session.ReviewRoundId }).IsUnique();
        builder.HasOne<ReviewRound>().WithMany().HasForeignKey(session => session.ReviewRoundId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(session => session.Facilitators).WithOne().HasForeignKey(facilitator => facilitator.SessionId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(session => session.Facilitators).AutoInclude();
    }
}

public sealed class CalibrationFacilitatorConfiguration : IEntityTypeConfiguration<CalibrationFacilitator>
{
    public void Configure(EntityTypeBuilder<CalibrationFacilitator> builder)
    {
        builder.ToTable("CalibrationFacilitators");
        builder.HasKey(facilitator => facilitator.Id);
        // Named through the session's collection, so a new row must read as Added, not as an update.
        builder.Property(facilitator => facilitator.Id).ValueGeneratedNever();
        builder.Property(facilitator => facilitator.DisplayName).IsRequired().HasMaxLength(300);
        builder.HasIndex(facilitator => facilitator.TenantId);
        builder.HasIndex(facilitator => new { facilitator.SessionId, facilitator.UserId }).IsUnique();
    }
}

public sealed class CalibrationSubjectConfiguration : IEntityTypeConfiguration<CalibrationSubject>
{
    public void Configure(EntityTypeBuilder<CalibrationSubject> builder)
    {
        builder.ToTable("CalibrationSubjects");
        builder.HasKey(subject => subject.Id);
        builder.Property(subject => subject.Version).IsRowVersion();
        builder.Property(subject => subject.Rationale).HasMaxLength(2000);
        builder.Property(subject => subject.DiscussionState).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Ignore(subject => subject.CurrentRating);
        builder.Ignore(subject => subject.IsAdjusted);
        builder.HasIndex(subject => subject.TenantId);
        builder.HasIndex(subject => new { subject.SessionId, subject.ReviewId }).IsUnique();
        builder.HasOne<CalibrationSession>().WithMany().HasForeignKey(subject => subject.SessionId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PerformanceReview>().WithMany().HasForeignKey(subject => subject.ReviewId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class CalibrationAdjustmentConfiguration : IEntityTypeConfiguration<CalibrationAdjustment>
{
    public void Configure(EntityTypeBuilder<CalibrationAdjustment> builder)
    {
        builder.ToTable("CalibrationAdjustments");
        builder.HasKey(adjustment => adjustment.Id);
        builder.Property(adjustment => adjustment.ActorDisplayName).IsRequired().HasMaxLength(300);
        builder.Property(adjustment => adjustment.Rationale).HasMaxLength(2000);
        builder.HasIndex(adjustment => adjustment.TenantId);
        builder.HasIndex(adjustment => new { adjustment.SubjectId, adjustment.At });
        builder.HasOne<CalibrationSubject>().WithMany().HasForeignKey(adjustment => adjustment.SubjectId).OnDelete(DeleteBehavior.Restrict);
    }
}

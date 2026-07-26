using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class PerformanceCheckInConfiguration : IEntityTypeConfiguration<PerformanceCheckIn>
{
    public void Configure(EntityTypeBuilder<PerformanceCheckIn> builder)
    {
        builder.ToTable("PerformanceCheckIns");
        builder.HasKey(checkIn => checkIn.Id);

        builder.Property(checkIn => checkIn.Version).IsRowVersion();
        builder.Property(checkIn => checkIn.TenantId).IsRequired();
        builder.Property(checkIn => checkIn.CycleId).IsRequired();
        builder.Property(checkIn => checkIn.EmployeeId).IsRequired();
        builder.Property(checkIn => checkIn.CreatedByReviewerId).IsRequired();
        builder.Property(checkIn => checkIn.CreatedByReviewerName).HasMaxLength(256).IsRequired();
        builder.Property(checkIn => checkIn.ReviewerRelationship).HasMaxLength(64);
        builder.Property(checkIn => checkIn.PlannedDate).IsRequired();
        builder.Property(checkIn => checkIn.PlannedTime).HasMaxLength(PerformanceCheckIn.TimeMaxLength);
        builder.Property(checkIn => checkIn.Reason).HasMaxLength(PerformanceCheckIn.ReasonMaxLength).IsRequired();
        builder.Property(checkIn => checkIn.Agenda).HasMaxLength(PerformanceCheckIn.AgendaMaxLength);
        builder.Property(checkIn => checkIn.Status)
            .HasConversion<int>()
            .IsRequired()
            .HasDefaultValue(CheckInStatus.Planned);
        builder.Property(checkIn => checkIn.CompletionSummary).HasMaxLength(PerformanceCheckIn.SummaryMaxLength);
        builder.Property(checkIn => checkIn.CompletedByReviewerId);
        builder.Property(checkIn => checkIn.CompletedByReviewerName).HasMaxLength(256);
        builder.Property(checkIn => checkIn.CompletedAt);
        builder.Property(checkIn => checkIn.CancellationReason).HasMaxLength(PerformanceCheckIn.CancellationReasonMaxLength);
        builder.Property(checkIn => checkIn.CancelledByReviewerId);
        builder.Property(checkIn => checkIn.CancelledAt);
        builder.Property(checkIn => checkIn.CreatedBy).HasMaxLength(256);
        builder.Property(checkIn => checkIn.UpdatedBy).HasMaxLength(256);

        builder.HasOne<PerformanceCycle>()
            .WithMany()
            .HasForeignKey(checkIn => checkIn.CycleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.OwnsMany(checkIn => checkIn.LinkedObjectives, linked =>
        {
            linked.ToTable("PerformanceCheckInLinkedObjectives");
            linked.WithOwner().HasForeignKey(item => item.CheckInId);
            linked.HasKey(item => item.Id);
            linked.Property(item => item.Id).ValueGeneratedNever();
            linked.Property(item => item.CheckInId).IsRequired();
            linked.Property(item => item.ObjectiveId).IsRequired();
            linked.Property(item => item.ObjectiveTitle).HasMaxLength(EmployeeObjective.TitleMaxLength).IsRequired();
            linked.Property(item => item.WasDiscussed).IsRequired();
            linked.Property(item => item.CreatedBy).HasMaxLength(256);
            linked.Property(item => item.UpdatedBy).HasMaxLength(256);
            linked.HasIndex(item => new { item.CheckInId, item.ObjectiveId })
                .IsUnique()
                .HasDatabaseName("IX_PerformanceCheckInLinkedObjectives_CheckIn_Objective");
        });
        builder.Metadata.FindNavigation(nameof(PerformanceCheckIn.LinkedObjectives))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.OwnsMany(checkIn => checkIn.RescheduleHistory, entry =>
        {
            entry.ToTable("PerformanceCheckInRescheduleEntries");
            entry.WithOwner().HasForeignKey(item => item.CheckInId);
            entry.HasKey(item => item.Id);
            entry.Property(item => item.Id).ValueGeneratedNever();
            entry.Property(item => item.CheckInId).IsRequired();
            entry.Property(item => item.PreviousDate).IsRequired();
            entry.Property(item => item.PreviousTime).HasMaxLength(PerformanceCheckIn.TimeMaxLength);
            entry.Property(item => item.NewDate).IsRequired();
            entry.Property(item => item.NewTime).HasMaxLength(PerformanceCheckIn.TimeMaxLength);
            entry.Property(item => item.ActorReviewerId).IsRequired();
            entry.Property(item => item.ActorName).HasMaxLength(256).IsRequired();
            entry.Property(item => item.OccurredAt).IsRequired();
            entry.Property(item => item.CreatedBy).HasMaxLength(256);
            entry.Property(item => item.UpdatedBy).HasMaxLength(256);
            entry.HasIndex(item => new { item.CheckInId, item.OccurredAt })
                .HasDatabaseName("IX_PerformanceCheckInRescheduleEntries_CheckIn_OccurredAt");
        });
        builder.Metadata.FindNavigation(nameof(PerformanceCheckIn.RescheduleHistory))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.OwnsMany(checkIn => checkIn.Addenda, addendum =>
        {
            addendum.ToTable("PerformanceCheckInAddenda");
            addendum.WithOwner().HasForeignKey(item => item.CheckInId);
            addendum.HasKey(item => item.Id);
            addendum.Property(item => item.Id).ValueGeneratedNever();
            addendum.Property(item => item.CheckInId).IsRequired();
            addendum.Property(item => item.AuthorReviewerId).IsRequired();
            addendum.Property(item => item.AuthorName).HasMaxLength(256).IsRequired();
            addendum.Property(item => item.Text).HasMaxLength(PerformanceCheckInAddendum.TextMaxLength).IsRequired();
            addendum.Property(item => item.CreatedAtUtc).IsRequired();
            addendum.Property(item => item.CreatedBy).HasMaxLength(256);
            addendum.Property(item => item.UpdatedBy).HasMaxLength(256);
            addendum.HasIndex(item => new { item.CheckInId, item.CreatedAtUtc })
                .HasDatabaseName("IX_PerformanceCheckInAddenda_CheckIn_CreatedAt");
        });
        builder.Metadata.FindNavigation(nameof(PerformanceCheckIn.Addenda))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.OwnsOne(checkIn => checkIn.Response, response =>
        {
            response.ToTable("PerformanceCheckInResponses");
            response.WithOwner().HasForeignKey(item => item.CheckInId);
            response.HasKey(item => item.Id);
            response.Property(item => item.Id).ValueGeneratedNever();
            response.Property(item => item.CheckInId).IsRequired();
            response.Property(item => item.EmployeeId).IsRequired();
            response.Property(item => item.Text).HasMaxLength(PerformanceCheckInResponse.TextMaxLength).IsRequired();
            response.Property(item => item.CreatedAtUtc).IsRequired();
            response.Property(item => item.CreatedBy).HasMaxLength(256);
            response.Property(item => item.UpdatedBy).HasMaxLength(256);
            response.HasIndex(item => item.CheckInId)
                .IsUnique()
                .HasDatabaseName("IX_PerformanceCheckInResponses_CheckIn");
        });
        builder.Metadata.FindNavigation(nameof(PerformanceCheckIn.Response))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(checkIn => new { checkIn.TenantId, checkIn.CycleId, checkIn.EmployeeId, checkIn.Status })
            .HasDatabaseName("IX_PerformanceCheckIns_Tenant_Cycle_Employee_Status");
        builder.HasIndex(checkIn => new { checkIn.TenantId, checkIn.EmployeeId, checkIn.Status })
            .HasDatabaseName("IX_PerformanceCheckIns_Tenant_Employee_Status");
        builder.HasIndex(checkIn => new { checkIn.TenantId, checkIn.Status, checkIn.PlannedDate })
            .HasDatabaseName("IX_PerformanceCheckIns_Tenant_Status_PlannedDate");

        builder.Ignore(checkIn => checkIn.DomainEvents);
    }
}

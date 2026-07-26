using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class CheckInFollowUpActionConfiguration : IEntityTypeConfiguration<CheckInFollowUpAction>
{
    public void Configure(EntityTypeBuilder<CheckInFollowUpAction> builder)
    {
        builder.ToTable("CheckInFollowUpActions");
        builder.HasKey(action => action.Id);

        builder.Property(action => action.Version).IsRowVersion();
        builder.Property(action => action.TenantId).IsRequired();
        builder.Property(action => action.CycleId).IsRequired();
        builder.Property(action => action.CheckInId).IsRequired();
        builder.Property(action => action.EmployeeId).IsRequired();
        builder.Property(action => action.Description).HasMaxLength(CheckInFollowUpAction.DescriptionMaxLength).IsRequired();
        builder.Property(action => action.OwnerKind).HasConversion<int>().IsRequired();
        builder.Property(action => action.OwnerEmployeeId).IsRequired();
        builder.Property(action => action.OwnerName).HasMaxLength(256).IsRequired();
        builder.Property(action => action.DueDate).IsRequired();
        builder.Property(action => action.LinkedObjectiveId);
        builder.Property(action => action.Status)
            .HasConversion<int>()
            .IsRequired()
            .HasDefaultValue(FollowUpActionStatus.Open);
        builder.Property(action => action.ResolutionNote).HasMaxLength(CheckInFollowUpAction.NoteMaxLength);
        builder.Property(action => action.ResolvedAt);
        builder.Property(action => action.CreatedBy).HasMaxLength(256);
        builder.Property(action => action.UpdatedBy).HasMaxLength(256);

        builder.HasOne<PerformanceCheckIn>()
            .WithMany()
            .HasForeignKey(action => action.CheckInId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.OwnsMany(action => action.StatusEvents, statusEvent =>
        {
            statusEvent.ToTable("CheckInFollowUpActionStatusEvents");
            statusEvent.WithOwner().HasForeignKey(item => item.ActionId);
            statusEvent.HasKey(item => item.Id);
            statusEvent.Property(item => item.Id).ValueGeneratedNever();
            statusEvent.Property(item => item.ActionId).IsRequired();
            statusEvent.Property(item => item.FromStatus).HasConversion<int>().IsRequired();
            statusEvent.Property(item => item.ToStatus).HasConversion<int>().IsRequired();
            statusEvent.Property(item => item.ActorEmployeeId).IsRequired();
            statusEvent.Property(item => item.ActorName).HasMaxLength(256).IsRequired();
            statusEvent.Property(item => item.Note).HasMaxLength(CheckInFollowUpActionStatusEvent.NoteMaxLength);
            statusEvent.Property(item => item.OccurredAt).IsRequired();
            statusEvent.Property(item => item.CreatedBy).HasMaxLength(256);
            statusEvent.Property(item => item.UpdatedBy).HasMaxLength(256);
            statusEvent.HasIndex(item => new { item.ActionId, item.OccurredAt })
                .HasDatabaseName("IX_CheckInFollowUpActionStatusEvents_Action_OccurredAt");
        });
        builder.Metadata.FindNavigation(nameof(CheckInFollowUpAction.StatusEvents))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(action => new { action.TenantId, action.OwnerEmployeeId, action.Status, action.DueDate })
            .HasDatabaseName("IX_CheckInFollowUpActions_Tenant_Owner_Status_Due");
        builder.HasIndex(action => action.CheckInId)
            .HasDatabaseName("IX_CheckInFollowUpActions_CheckIn");
        builder.HasIndex(action => new { action.TenantId, action.CycleId, action.EmployeeId, action.Status })
            .HasDatabaseName("IX_CheckInFollowUpActions_Tenant_Cycle_Employee_Status");

        builder.Ignore(action => action.DomainEvents);
    }
}

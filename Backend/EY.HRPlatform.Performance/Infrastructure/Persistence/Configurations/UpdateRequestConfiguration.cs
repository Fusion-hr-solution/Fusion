using EY.HRPlatform.Performance.Domain.Plans;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence.Configurations;

public sealed class UpdateRequestConfiguration : IEntityTypeConfiguration<UpdateRequest>
{
    public void Configure(EntityTypeBuilder<UpdateRequest> builder)
    {
        builder.ToTable("UpdateRequests");
        builder.HasKey(request => request.Id);
        builder.Property(request => request.Version).IsRowVersion();
        builder.Property(request => request.RequestedByName).IsRequired().HasMaxLength(300);
        builder.Property(request => request.Note).HasMaxLength(500);
        builder.Property(request => request.State).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(request => request.TenantId);
        builder.HasIndex(request => new { request.TenantId, request.CycleId, request.PlanId });
        builder.HasIndex(request => new { request.TenantId, request.EmployeeId, request.State });
        // One open request per target, enforced by the database rather than request timing.
        builder.HasIndex(request => new { request.TenantId, request.TargetKey }).IsUnique().HasFilter("\"State\" = 'Open'");
        builder.HasOne<EmployeePlan>().WithMany().HasForeignKey(request => request.PlanId).OnDelete(DeleteBehavior.Restrict);
    }
}

using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class UserAccessProfileConfiguration : IEntityTypeConfiguration<UserAccessProfile>
{
    public void Configure(EntityTypeBuilder<UserAccessProfile> builder)
    {
        builder.ToTable("UserAccessProfiles");

        builder.HasKey(assignment => new { assignment.UserId, assignment.AccessProfileId });

        builder.HasIndex(assignment => assignment.TenantId);
        builder.HasIndex(assignment => assignment.AccessProfileId);

        builder.HasOne(assignment => assignment.User)
            .WithMany(user => user.AccessProfileAssignments)
            .HasForeignKey(assignment => assignment.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

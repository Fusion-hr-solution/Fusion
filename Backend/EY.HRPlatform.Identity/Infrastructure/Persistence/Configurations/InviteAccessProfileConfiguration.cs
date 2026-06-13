using EY.HRPlatform.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EY.HRPlatform.Identity.Infrastructure.Persistence.Configurations;

public class InviteAccessProfileConfiguration : IEntityTypeConfiguration<InviteAccessProfile>
{
    public void Configure(EntityTypeBuilder<InviteAccessProfile> builder)
    {
        builder.ToTable("InviteAccessProfiles");

        builder.HasKey(assignment => new { assignment.InviteTokenId, assignment.AccessProfileId });

        builder.HasIndex(assignment => assignment.TenantId);
        builder.HasIndex(assignment => assignment.AccessProfileId);

        builder.HasOne(assignment => assignment.InviteToken)
            .WithMany(invite => invite.AccessProfileAssignments)
            .HasForeignKey(assignment => assignment.InviteTokenId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

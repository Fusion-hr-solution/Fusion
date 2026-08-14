using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace EY.HRPlatform.CoreHR.Features.Organization;

internal static class OrganizationWriteTransaction
{
    public static async Task<IDbContextTransaction?> BeginAsync(
        CoreHRDbContext dbContext,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        if (!dbContext.Database.IsRelational()) return null;
        var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        if (dbContext.Database.IsNpgsql())
        {
            var key = BitConverter.ToInt64(tenantId.ToByteArray(), 0);
            await dbContext.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({key})", cancellationToken);
        }
        return transaction;
    }
}

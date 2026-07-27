using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Microsoft.EntityFrameworkCore.Storage;

namespace EY.HRPlatform.DemoSeed;

/// <summary>
/// Deletes only tenant-owned rows using the EF model's foreign-key ordering. The caller must
/// enforce Development-only access and wrap this operation in its service transaction.
/// </summary>
public static class CanonicalTenantResetter
{
    public static async Task ResetAsync(DbContext dbContext, Guid tenantId, CancellationToken cancellationToken = default)
    {
        if (tenantId != CanonicalDemoSeed.TenantId)
            throw new InvalidOperationException("Canonical reset is restricted to the configured demo tenant.");

        var tables = dbContext.Model.GetEntityTypes()
            .Where(entityType => !entityType.IsOwned()
                && entityType.FindProperty("TenantId")?.ClrType == typeof(Guid)
                && entityType.GetTableName() is not null)
            .Select(entityType => new TenantTable(
                entityType,
                entityType.GetSchema() ?? dbContext.Model.GetDefaultSchema() ?? "public",
                entityType.GetTableName()!))
            .GroupBy(table => $"{table.Schema}.{table.Name}", StringComparer.Ordinal)
            .Select(group => group.First())
            .ToDictionary(table => table.Key, StringComparer.Ordinal);

        var ordered = OrderChildrenFirst(tables.Values);
        var connection = dbContext.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(cancellationToken);

        foreach (var table in ordered)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = dbContext.Database.CurrentTransaction?.GetDbTransaction();
            command.CommandText = $"DELETE FROM {Quote(table.Schema)}.{Quote(table.Name)} WHERE {Quote("TenantId")} = @tenantId";
            var parameter = command.CreateParameter();
            parameter.ParameterName = "tenantId";
            parameter.Value = tenantId;
            command.Parameters.Add(parameter);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        dbContext.ChangeTracker.Clear();
    }

    private static IReadOnlyList<TenantTable> OrderChildrenFirst(IEnumerable<TenantTable> tables)
    {
        var byKey = tables.ToDictionary(table => table.Key, StringComparer.Ordinal);
        var result = new List<TenantTable>(byKey.Count);
        var visiting = new HashSet<string>(StringComparer.Ordinal);
        var visited = new HashSet<string>(StringComparer.Ordinal);

        void Visit(TenantTable table)
        {
            if (visited.Contains(table.Key)) return;
            if (!visiting.Add(table.Key))
                throw new InvalidOperationException($"Canonical reset found a foreign-key cycle at {table.Key}.");

            foreach (var foreignKey in table.EntityType.GetForeignKeys())
            {
                var principal = foreignKey.PrincipalEntityType;
                var principalKey = $"{principal.GetSchema() ?? "public"}.{principal.GetTableName()}";
                if (principalKey != table.Key && byKey.TryGetValue(principalKey, out var principalTable))
                    Visit(principalTable);
            }

            visiting.Remove(table.Key);
            visited.Add(table.Key);
            result.Add(table);
        }

        foreach (var table in byKey.Values)
            Visit(table);

        result.Reverse();
        return result;
    }

    private static string Quote(string identifier) => $"\"{identifier.Replace("\"", "\"\"")}\"";

    private sealed record TenantTable(IEntityType EntityType, string Schema, string Name)
    {
        public string Key => $"{Schema}.{Name}";
    }
}

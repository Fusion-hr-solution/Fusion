using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Identity.Tests.Features.Eligibility;

public sealed class PermissionCatalogCompletenessTests
{
    [Fact]
    public void EveryDeclaredPermission_HasExactlyOneCatalogDefinition_AndViceVersa()
    {
        var declaredKeys = CorePermissions.All
            .Concat(PerformancePermissions.All)
            .Concat(ModuleSettingsPermissions.All)
            .ToList();
        var catalogKeys = CorePermissionCatalog.All
            .Select(definition => definition.Key)
            .ToList();

        var duplicateDeclarations = FindDuplicates(declaredKeys);
        var duplicateDefinitions = FindDuplicates(catalogKeys);
        var missingDefinitions = declaredKeys
            .Except(catalogKeys, StringComparer.Ordinal)
            .OrderBy(key => key, StringComparer.Ordinal)
            .ToList();
        var undeclaredDefinitions = catalogKeys
            .Except(declaredKeys, StringComparer.Ordinal)
            .OrderBy(key => key, StringComparer.Ordinal)
            .ToList();

        Assert.True(
            duplicateDeclarations.Count == 0
            && duplicateDefinitions.Count == 0
            && missingDefinitions.Count == 0
            && undeclaredDefinitions.Count == 0,
            $"Permission catalog mismatch. "
            + $"Duplicate declarations: {Format(duplicateDeclarations)}. "
            + $"Duplicate definitions: {Format(duplicateDefinitions)}. "
            + $"Missing definitions: {Format(missingDefinitions)}. "
            + $"Undeclared definitions: {Format(undeclaredDefinitions)}.");
    }

    private static List<string> FindDuplicates(IEnumerable<string> keys)
        => keys
            .GroupBy(key => key, StringComparer.Ordinal)
            .Where(group => group.Count() != 1)
            .Select(group => group.Key)
            .OrderBy(key => key, StringComparer.Ordinal)
            .ToList();

    private static string Format(IReadOnlyCollection<string> keys)
        => keys.Count == 0 ? "none" : string.Join(", ", keys);
}

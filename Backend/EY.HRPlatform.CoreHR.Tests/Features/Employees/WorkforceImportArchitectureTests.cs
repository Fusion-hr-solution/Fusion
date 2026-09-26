using System.Reflection;
using EY.HRPlatform.CoreHR.Features.Employees.Import;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

/// <summary>Boundaries that must hold by construction, not only by convention.</summary>
public sealed class WorkforceImportArchitectureTests
{
    private static readonly Assembly CoreHR = typeof(WorkforceImportSession).Assembly;

    [Fact]
    public void CoreHR_never_references_Performance()
        => Assert.DoesNotContain(CoreHR.GetReferencedAssemblies(), a => a.Name?.Contains("Performance", StringComparison.OrdinalIgnoreCase) == true);

    [Fact]
    public void Workforce_import_types_expose_nothing_from_Performance()
    {
        var importTypes = CoreHR.GetTypes().Where(t => t.Namespace?.StartsWith("EY.HRPlatform.CoreHR.Features.Employees.Import", StringComparison.Ordinal) == true);
        foreach (var type in importTypes)
        {
            var members = type.GetMembers(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly);
            var referenced = members.SelectMany(m => m switch
            {
                FieldInfo f => [f.FieldType],
                PropertyInfo p => [p.PropertyType],
                MethodInfo mi => mi.GetParameters().Select(x => x.ParameterType).Append(mi.ReturnType),
                ConstructorInfo c => c.GetParameters().Select(x => x.ParameterType),
                _ => Array.Empty<Type>(),
            });
            Assert.DoesNotContain(referenced, t => t.FullName?.Contains(".Performance", StringComparison.Ordinal) == true);
        }
    }

    [Fact]
    public void Match_readiness_depends_only_on_the_interpretation_and_plan()
    {
        var method = typeof(EY.HRPlatform.CoreHR.Features.Employees.Import.Services.WorkforceImportMatchReadiness).GetMethod("Evaluate")!;
        Assert.Equal(
            ["WorkforceInterpretationResult", "WorkforceImportMappingPlan", "Boolean"],
            method.GetParameters().Select(p => p.ParameterType.Name));
    }
}

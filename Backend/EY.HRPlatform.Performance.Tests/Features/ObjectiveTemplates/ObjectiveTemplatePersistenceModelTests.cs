using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.ObjectiveTemplates;

public class ObjectiveTemplatePersistenceModelTests
{
    [Fact]
    public void ObjectiveTemplateRevision_Uses_TemplateId_As_Its_Only_Container_Foreign_Key()
    {
        using var db = PerformanceTestContext.Create(Guid.NewGuid(), out _);

        var entityType = db.Model.FindEntityType(typeof(EY.HRPlatform.Performance.Domain.Entities.ObjectiveTemplateRevision));

        Assert.NotNull(entityType);
        Assert.Null(entityType!.FindProperty("ObjectiveTemplateId"));

        var foreignKeys = entityType.GetForeignKeys()
            .Where(fk => fk.PrincipalEntityType.ClrType == typeof(EY.HRPlatform.Performance.Domain.Entities.ObjectiveTemplate))
            .ToList();

        Assert.Single(foreignKeys);
        Assert.Equal("TemplateId", foreignKeys[0].Properties.Single().Name);
    }
}

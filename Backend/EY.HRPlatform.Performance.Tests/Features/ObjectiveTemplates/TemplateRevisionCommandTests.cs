using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Commands;
using EY.HRPlatform.Performance.Features.ObjectiveTemplates.Dtos;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.ObjectiveTemplates;

public class TemplateRevisionCommandTests
{
    [Fact]
    public async Task EditActiveViaNewRevision_Creates_Draft_Without_Mutating_Active_Revision()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);

        var template = ObjectiveTemplate.Create(tenantId);
        template.CreateDraftRevision(
            "Coaching Quality",
            null,
            null,
            "Qualitative",
            null,
            null,
            null,
            null,
            "Monthly coaching completed.",
            Guid.NewGuid().ToString(),
            "Seeder");
        template.ActivateRevision(Guid.NewGuid().ToString(), "Seeder", null);

        db.ObjectiveTemplateContainers.Add(template);
        await db.SaveChangesAsync();

        var handler = new EditActiveViaNewRevisionCommandHandler(
            db,
            tenantContext,
            new ConfigurationAuditWriter(db),
            new FakeCoreWorkforceClient());

        var actor = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim("full_name", "Policy Admin"),
            ],
            "test"));

        var result = await handler.Handle(
            new EditActiveViaNewRevisionCommand(
                template.Id,
                actor,
                new CreateTemplateDraftRequest(
                    "Coaching Quality Revised",
                    null,
                    null,
                    "Qualitative",
                    null,
                    null,
                    null,
                    null,
                    "Monthly coaching completed.")),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Active", result.Value.Status);
        Assert.Equal("Coaching Quality", result.Value.ActiveRevision?.Title);
        Assert.Equal("Coaching Quality Revised", result.Value.DraftRevision?.Title);
        Assert.Equal(2, result.Value.DraftRevision?.VersionNumber);
        Assert.Equal(result.Value.ActiveRevision?.Id, result.Value.DraftRevision?.SourceRevisionId);
    }
}

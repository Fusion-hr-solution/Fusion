using System.Security.Claims;
using System.Text;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.CoreHR.Features.OrganizationImport;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrganizationImport;

public sealed class OrganizationImportControllerTests
{
    [Fact]
    public async Task EveryEndpoint_FailsClosedWithoutOrganizationManage()
    {
        var (controller, imports, workbooks, access) = CreateController(canManage: false);

        Assert.IsType<ForbidResult>(await controller.DownloadTemplate(CancellationToken.None));
        Assert.IsType<ForbidResult>(await controller.Export(new DateOnly(2026, 8, 12), CancellationToken.None));
        Assert.IsType<ForbidResult>(await controller.Intake(
            null!, new DateOnly(2026, 8, 12), Guid.NewGuid(), null, CancellationToken.None));
        Assert.IsType<ForbidResult>((await controller.GetActive(CancellationToken.None)).Result);
        Assert.IsType<ForbidResult>((await controller.Get(Guid.NewGuid(), CancellationToken.None)).Result);
        Assert.IsType<ForbidResult>((await controller.ChangeEffectiveDate(
            Guid.NewGuid(), "\"1\"", new UpdateOrganizationImportEffectiveDateRequest(new DateOnly(2026, 8, 12)),
            CancellationToken.None)).Result);
        Assert.IsType<ForbidResult>((await controller.Discard(Guid.NewGuid(), "\"1\"", CancellationToken.None)).Result);
        Assert.IsType<ForbidResult>((await controller.ReplaceDecisions(
            Guid.NewGuid(), "\"1\"", new ReplaceOrganizationImportDecisionsRequest(new OrganizationImportDecisions()), CancellationToken.None)).Result);
        Assert.IsType<ForbidResult>((await controller.Refresh(Guid.NewGuid(), CancellationToken.None)).Result);
        Assert.IsType<ForbidResult>((await controller.GenerateSemanticSuggestions(
            Guid.NewGuid(), new(new string('f', 64)), CancellationToken.None)).Result);
        Assert.IsType<ForbidResult>((await controller.ApplySemanticSuggestions(
            Guid.NewGuid(), Guid.NewGuid(), "\"1\"", new(new string('f', 64), 1, []), CancellationToken.None)).Result);
        Assert.IsType<ForbidResult>((await controller.Commit(
            Guid.NewGuid(), "\"1\"", new CommitOrganizationImportRequest("digest"), CancellationToken.None)).Result);

        access.Verify(policy => policy.CanManageOrganization(It.IsAny<ClaimsPrincipal>()), Times.Exactly(12));
        imports.VerifyNoOtherCalls();
        workbooks.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task TemplateAndExport_ReturnBoundedXlsxDownloadsAndSafeSourceProblem()
    {
        var (controller, _, workbooks, _) = CreateController();
        workbooks.Setup(service => service.CreateTemplateAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationImportWorkbook([1, 2, 3], "Fusion-organization-template.xlsx"));
        workbooks.Setup(service => service.CreateExportAsync(new DateOnly(2026, 8, 12), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OrganizationImportSourceException("NoCanonicalRootAsOfDate", "There is no current structure to export for this date."));

        var template = Assert.IsType<FileContentResult>(await controller.DownloadTemplate(CancellationToken.None));
        Assert.Equal("Fusion-organization-template.xlsx", template.FileDownloadName);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", template.ContentType);

        var export = Assert.IsType<ObjectResult>(await controller.Export(new DateOnly(2026, 8, 12), CancellationToken.None));
        Assert.Equal(422, export.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(export.Value);
        Assert.Equal("NoCanonicalRootAsOfDate", problem.Extensions["code"]);
    }

    [Fact]
    public async Task Intake_UsesMultipartContractCreationStatusSheetChoiceAndEtag()
    {
        var (controller, imports, _, _) = CreateController();
        var date = new DateOnly(2026, 8, 12);
        var token = Guid.NewGuid();
        var session = Session(version: 7);
        imports.Setup(service => service.IntakeAsync(
                It.IsAny<Stream>(), "organization.csv", "text/csv", date, token, null,
                It.Is<OrganizationImportActor>(actor => actor.DisplayName == "Ada Admin"), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationImportIntakeResult(OrganizationImportIntakeKind.SourceReady, false, session, null));
        var file = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("Name\nRoot")), 0, 9, "file", "organization.csv")
        {
            Headers = new HeaderDictionary(),
            ContentType = "text/csv",
        };

        var created = Assert.IsType<ObjectResult>(await controller.Intake(file, date, token, null, CancellationToken.None));
        Assert.Equal(201, created.StatusCode);
        Assert.Equal("\"7\"", controller.Response.Headers.ETag);

        imports.Reset();
        imports.Setup(service => service.IntakeAsync(
                It.IsAny<Stream>(), "organization.csv", "text/csv", date, token, null,
                It.IsAny<OrganizationImportActor>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationImportIntakeResult(
                OrganizationImportIntakeKind.SheetSelectionRequired,
                false,
                null,
                new OrganizationSourceChoice("organization.xlsx", "xlsx", 20, new string('a', 64), ["North", "South"])));
        controller.Response.Headers.ETag = string.Empty;

        Assert.IsType<OkObjectResult>(await controller.Intake(file, date, token, null, CancellationToken.None));
        Assert.True(string.IsNullOrEmpty(controller.Response.Headers.ETag));
    }

    [Fact]
    public async Task EffectiveDateAndDiscard_RequireAndReturnCurrentEtags()
    {
        var (controller, imports, _, _) = CreateController();
        var id = Guid.NewGuid();
        var date = new DateOnly(2026, 10, 1);
        Assert.IsType<BadRequestObjectResult>((await controller.ChangeEffectiveDate(
            id, null, new UpdateOrganizationImportEffectiveDateRequest(date), CancellationToken.None)).Result);

        imports.Setup(service => service.ChangeEffectiveDateAsync(
                id, 3, date, It.IsAny<OrganizationImportActor>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Session(id, date, 4));
        Assert.IsType<OkObjectResult>((await controller.ChangeEffectiveDate(
            id, "\"3\"", new UpdateOrganizationImportEffectiveDateRequest(date), CancellationToken.None)).Result);
        Assert.Equal("\"4\"", controller.Response.Headers.ETag);

        imports.Setup(service => service.DiscardAsync(
                id, 4, It.IsAny<OrganizationImportActor>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Session(id, date, 5, "Discarded"));
        Assert.IsType<OkObjectResult>((await controller.Discard(id, "\"4\"", CancellationToken.None)).Result);
        Assert.Equal("\"5\"", controller.Response.Headers.ETag);
    }

    [Fact]
    public async Task DecisionsRefreshAndCommit_UseEtagActorAndReviewedDigest()
    {
        var (controller, imports, _, _) = CreateController();
        var id = Guid.NewGuid();
        var decisions = new OrganizationImportDecisions(IntroducedRoot: new("Asteria", "ASTERIA"));
        imports.Setup(service => service.ReplaceDecisionsAsync(id, 6, decisions,
                It.Is<OrganizationImportActor>(actor => actor.DisplayName == "Ada Admin"), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Session(id, version: 7));
        imports.Setup(service => service.RefreshAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(Session(id, version: 7));
        var terminal = new OrganizationImportCommitResult(id, new DateOnly(2026, 8, 12), [], true);
        imports.Setup(service => service.CommitAsync(id, 7, "digest", It.IsAny<OrganizationImportActor>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(terminal);

        Assert.IsType<BadRequestObjectResult>((await controller.ReplaceDecisions(
            id, null, new ReplaceOrganizationImportDecisionsRequest(decisions), CancellationToken.None)).Result);
        Assert.IsType<OkObjectResult>((await controller.ReplaceDecisions(
            id, "\"6\"", new ReplaceOrganizationImportDecisionsRequest(decisions), CancellationToken.None)).Result);
        Assert.Equal("\"7\"", controller.Response.Headers.ETag);
        Assert.IsType<OkObjectResult>((await controller.Refresh(id, CancellationToken.None)).Result);
        Assert.IsType<OkObjectResult>((await controller.Commit(
            id, "\"7\"", new CommitOrganizationImportRequest("digest"), CancellationToken.None)).Result);
    }

    [Fact]
    public async Task SemanticGenerationAndApply_UsePermissionAttemptVersionAndSessionEtag()
    {
        var semantic = new Mock<IOrganizationImportSemanticAssistanceService>();
        var (controller, imports, _, _) = CreateController(semantic: semantic);
        var sessionId = Guid.NewGuid();
        var attemptId = Guid.NewGuid();
        var fingerprint = new string('f', 64);
        var generated = new OrganizationImportSemanticAssistanceDto(
            OrganizationImportSemanticAssistanceState.Available,
            fingerprint,
            attemptId,
            2,
            "Groq",
            OrganizationImportSemanticAssistanceOptions.DefaultModel,
            DateTime.UtcNow,
            DateTime.UtcNow,
            null,
            null,
            []);
        semantic.Setup(service => service.GenerateAsync(
                sessionId, It.Is<GenerateOrganizationImportSemanticSuggestionsRequest>(request => request.InputFingerprint == fingerprint),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(generated);
        var apply = new ApplyOrganizationImportSemanticSuggestionsRequest(
            fingerprint, 2, [new("shape", "shape:LevelColumns", OrganizationImportSemanticReviewOutcome.Accepted)]);
        semantic.Setup(service => service.ApplyAsync(
                sessionId, attemptId, 7, apply,
                It.Is<OrganizationImportActor>(actor => actor.DisplayName == "Ada Admin"), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        imports.Setup(service => service.GetAsync(sessionId, It.IsAny<CancellationToken>())).ReturnsAsync(Session(sessionId, version: 8));

        Assert.IsType<OkObjectResult>((await controller.GenerateSemanticSuggestions(
            sessionId, new(fingerprint), CancellationToken.None)).Result);
        Assert.IsType<BadRequestObjectResult>((await controller.ApplySemanticSuggestions(
            sessionId, attemptId, null, apply, CancellationToken.None)).Result);
        Assert.IsType<OkObjectResult>((await controller.ApplySemanticSuggestions(
            sessionId, attemptId, "\"7\"", apply, CancellationToken.None)).Result);
        Assert.Equal("\"8\"", controller.Response.Headers.ETag);
        semantic.VerifyAll();
    }

    private static (OrganizationImportController Controller, Mock<IOrganizationImportService> Imports,
        Mock<IOrganizationImportWorkbookService> Workbooks, Mock<ICoreAccessPolicyService> Access)
        CreateController(bool canManage = true, Mock<IOrganizationImportSemanticAssistanceService>? semantic = null)
    {
        var imports = new Mock<IOrganizationImportService>();
        var workbooks = new Mock<IOrganizationImportWorkbookService>();
        var access = new Mock<ICoreAccessPolicyService>();
        access.Setup(policy => policy.CanManageOrganization(It.IsAny<ClaimsPrincipal>())).Returns(canManage);
        var userId = Guid.NewGuid();
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(CustomClaimTypes.FullName, "Ada Admin")],
            "test"));
        var controller = new OrganizationImportController(imports.Object, workbooks.Object, access.Object, semantic?.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } },
        };
        return (controller, imports, workbooks, access);
    }

    private static OrganizationImportSessionDto Session(
        Guid? id = null,
        DateOnly? effectiveDate = null,
        uint version = 1,
        string status = "Active")
    {
        var actor = Guid.NewGuid();
        return new OrganizationImportSessionDto(
            id ?? Guid.NewGuid(), status, effectiveDate ?? new DateOnly(2026, 8, 12), version,
            actor, "Ada Admin", actor, "Ada Admin", DateTime.UtcNow, null,
            status == "Discarded" ? DateTime.UtcNow : null,
            new OrganizationImportSourceDto(
                "organization.csv", "csv", "text/csv", 9, new string('a', 64), "CSV", "A1:A2", 1, 1,
                status == "Discarded" ? DateTime.UtcNow : null,
                status == "Discarded" ? null : new OrganizationSourceTable(
                    [new OrganizationSourceColumn(0, "Name")], [new string?[] { "Root" }])),
            new CanonicalOrganizationBaselineSummary(true, false),
            new OrganizationImportDecisions().Normalize(),
            null, null, null, null, null, null);
    }
}

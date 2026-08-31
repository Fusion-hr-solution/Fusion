using System.Reflection;
using System.Security.Claims;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.CoreHR.Features.Employees.Import;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Features.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Moq;
using Xunit;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public sealed class WorkforceImportControllerTests
{
    [Fact]
    public void Controller_is_authorized_and_routed_under_canonical_import_path()
    {
        Assert.NotNull(typeof(WorkforceImportController).GetCustomAttribute<AuthorizeAttribute>(inherit: false));
        var route = typeof(WorkforceImportController).GetCustomAttribute<RouteAttribute>(inherit: false);
        Assert.Equal("api/corehr/employees/import", route!.Template);
    }

    [Fact]
    public void Template_service_creates_a_valid_xlsx_with_workforce_headers()
    {
        var template = new WorkforceImportTemplateService().Create();

        Assert.Equal("Fusion-workforce-template.xlsx", template.FileName);
        using var document = SpreadsheetDocument.Open(new MemoryStream(template.Bytes), false);
        var sheet = document.WorkbookPart!.Workbook.Sheets!.Elements<Sheet>().Single();
        var worksheet = (WorksheetPart)document.WorkbookPart.GetPartById(sheet.Id!);
        var headers = worksheet.Worksheet.Descendants<Cell>().Select(cell => cell.InnerText).ToArray();

        Assert.Equal(WorkforceImportTemplateService.SheetName, sheet.Name!.Value);
        Assert.Equal(WorkforceImportTemplateService.Headers, headers);
    }

    [Theory]
    [InlineData(nameof(WorkforceImportController.Intake), typeof(HttpPostAttribute), "intake")]
    [InlineData(nameof(WorkforceImportController.DownloadTemplate), typeof(HttpGetAttribute), "template")]
    [InlineData(nameof(WorkforceImportController.SelectHeader), typeof(HttpPutAttribute), "{sessionId:guid}/header")]
    [InlineData(nameof(WorkforceImportController.ChangeBaseline), typeof(HttpPutAttribute), "{sessionId:guid}/baseline")]
    [InlineData(nameof(WorkforceImportController.ReplaceSource), typeof(HttpPostAttribute), "{sessionId:guid}/replace-source")]
    [InlineData(nameof(WorkforceImportController.GetReview), typeof(HttpGetAttribute), "{sessionId:guid}/review")]
    [InlineData(nameof(WorkforceImportController.ApplyDecision), typeof(HttpPutAttribute), "{sessionId:guid}/decisions")]
    [InlineData(nameof(WorkforceImportController.Commit), typeof(HttpPostAttribute), "{sessionId:guid}/commit")]
    [InlineData(nameof(WorkforceImportController.SuggestMeanings), typeof(HttpPostAttribute), "{sessionId:guid}/semantic-suggestions")]
    [InlineData(nameof(WorkforceImportController.Finish), typeof(HttpPostAttribute), "{sessionId:guid}/finish")]
    [InlineData(nameof(WorkforceImportController.Discard), typeof(HttpPostAttribute), "{sessionId:guid}/discard")]
    public void Endpoints_use_expected_routes(string methodName, Type attributeType, string template)
    {
        var method = typeof(WorkforceImportController).GetMethod(methodName);
        Assert.NotNull(method);
        var attribute = (IRouteTemplateProvider?)method!.GetCustomAttribute(attributeType, inherit: false);
        Assert.NotNull(attribute);
        Assert.Equal(template, attribute!.Template);
    }

    [Fact]
    public void No_endpoint_declares_role_restrictions()
    {
        foreach (var method in typeof(WorkforceImportController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
        {
            var authorize = method.GetCustomAttribute<AuthorizeAttribute>(inherit: false);
            Assert.True(authorize is null || string.IsNullOrWhiteSpace(authorize.Roles));
        }
    }

    [Fact]
    public async Task Every_endpoint_forbids_a_caller_without_import_authority()
    {
        var controller = BuildController(canImport: false);
        var sid = Guid.NewGuid();

        Assert.IsType<ForbidResult>(await controller.GetActive(default));
        Assert.IsType<ForbidResult>(await controller.Get(sid, default));
        Assert.IsType<ForbidResult>(await controller.SelectHeader(sid, "\"1\"", new SelectHeaderRequest(1), default));
        Assert.IsType<ForbidResult>(await controller.ChangeBaseline(sid, "\"1\"", new ChangeBaselineRequest(new DateOnly(2026, 8, 17)), default));
        Assert.IsType<ForbidResult>(await controller.Prepare(sid, "\"1\"", default));
        Assert.IsType<ForbidResult>(await controller.GetReview(sid, null, null, 1, 20, default));
        Assert.IsType<ForbidResult>(await controller.ApplyDecision(sid, "\"1\"", new WorkforceDecisionRequest(null, null, null, null, null, null, null, null, null, null, null, null, null), default));
        Assert.IsType<ForbidResult>(await controller.SuggestMeanings(sid, default));
        Assert.IsType<ForbidResult>(await controller.Finish(sid, "\"1\"", default));
        Assert.IsType<ForbidResult>(await controller.Discard(sid, "\"1\"", default));
        Assert.IsType<ForbidResult>(await controller.Commit(sid, "\"1\"", default));
        Assert.IsType<ForbidResult>(await controller.GetCommitStatus(sid, default));
    }

    private static WorkforceImportController BuildController(bool canImport)
    {
        var policy = new Mock<ICoreAccessPolicyService>();
        policy.Setup(p => p.CanImportEmployees(It.IsAny<ClaimsPrincipal>())).Returns(canImport);
        return new WorkforceImportController(null!, null!, null!, null!, null!, policy.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity("test")) },
            },
        };
    }

    [Fact]
    public void Decision_request_maps_broadest_safe_scopes_onto_the_decision_document()
    {
        var orgId = Guid.NewGuid();
        var mgrId = Guid.NewGuid();
        var doc = new WorkforceImportDecisionDoc();

        new WorkforceDecisionRequest(
            ColumnMappings: new Dictionary<int, string> { [4] = "Manager" }, DateFormat: "DayMonthYear", NameFormat: null,
            OrganizationSourceValue: "Operations", OrganizationUnitId: orgId,
            ManagerRowNumber: 7, ManagerEmployeeId: mgrId, ManagerEmployeeKey: null, NoManager: null,
            ExcludeRow: 3, IncludeRow: null, KeepFusionUnchangedRow: 9, KeepAsDistinctRow: null).Apply(doc);

        Assert.Equal("Manager", doc.ColumnMappings[4]);
        Assert.Equal("DayMonthYear", doc.DateFormat);
        Assert.Equal(orgId, doc.OrganizationBySourceValue["operations"]); // normalized grouped key
        Assert.Equal(mgrId, doc.ManagerEmployeeByRow[7]);
        Assert.Contains(3, doc.ExcludedRows);
        Assert.Contains(9, doc.KeepFusionUnchangedRows);
    }
}

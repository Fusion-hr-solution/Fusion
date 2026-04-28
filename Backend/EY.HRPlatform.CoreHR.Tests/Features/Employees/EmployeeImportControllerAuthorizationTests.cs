using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeeImportControllerAuthorizationTests
{
    [Fact]
    public void Controller_RequiresHrAdminRoleAtClassLevel()
    {
        var attribute = typeof(EmployeeImportController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(attribute);
        Assert.Equal(PlatformRole.HRAdmin, attribute!.Roles);
    }

    [Fact]
    public void ValidateEndpoint_UsesExpectedPostRoute()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.Validate));

        Assert.NotNull(method);

        var attribute = method!.GetCustomAttribute<HttpPostAttribute>(inherit: false);

        Assert.NotNull(attribute);
        Assert.Equal("{sessionId:guid}/validate", attribute!.Template);
    }

    [Fact]
    public void ApplyEndpoint_UsesExpectedPostRoute()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.Apply));

        Assert.NotNull(method);

        var attribute = method!.GetCustomAttribute<HttpPostAttribute>(inherit: false);

        Assert.NotNull(attribute);
        Assert.Equal("{sessionId:guid}/apply", attribute!.Template);
    }

    [Fact]
    public void HistoryEndpoint_UsesExpectedGetRoute()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.GetHistory));

        Assert.NotNull(method);

        var attribute = method!.GetCustomAttribute<HttpGetAttribute>(inherit: false);

        Assert.NotNull(attribute);
        Assert.Equal("history", attribute!.Template);
    }

    [Fact]
    public void HistoryDetailEndpoint_UsesExpectedGetRoute()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.GetHistoryDetail));

        Assert.NotNull(method);

        var attribute = method!.GetCustomAttribute<HttpGetAttribute>(inherit: false);

        Assert.NotNull(attribute);
        Assert.Equal("history/{historyId:guid}", attribute!.Template);
    }
}
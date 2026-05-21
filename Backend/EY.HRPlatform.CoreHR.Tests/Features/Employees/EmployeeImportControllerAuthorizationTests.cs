using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeeImportControllerAuthorizationTests
{
    private const string PlatformAdminAndHrAdmin = PlatformRole.PlatformAdmin + "," + PlatformRole.HRAdmin;

    [Fact]
    public void Controller_HasAuthorizeAttributeAtClassLevel()
    {
        var attribute = typeof(EmployeeImportController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(attribute);
        Assert.Null(attribute!.Roles); // class-level is [Authorize] without roles
    }

    [Fact]
    public void GetSchema_AllowsPlatformAdminAndHrAdmin()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.GetSchema));
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(PlatformAdminAndHrAdmin, authorize!.Roles);
    }

    [Fact]
    public void DownloadTemplate_AllowsPlatformAdminAndHrAdmin()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.DownloadTemplate));
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(PlatformAdminAndHrAdmin, authorize!.Roles);
    }

    [Fact]
    public void Upload_RequiresHrAdminRole()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.Upload));
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(PlatformRole.HRAdmin, authorize!.Roles);
    }

    [Fact]
    public void Validate_RequiresHrAdminRole()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.Validate));
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(PlatformRole.HRAdmin, authorize!.Roles);
    }

    [Fact]
    public void Apply_RequiresHrAdminRole()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.Apply));
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(PlatformRole.HRAdmin, authorize!.Roles);
    }

    [Fact]
    public void GetHistory_AllowsPlatformAdminAndHrAdmin()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.GetHistory));
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(PlatformAdminAndHrAdmin, authorize!.Roles);
    }

    [Fact]
    public void GetHistoryDetail_AllowsPlatformAdminAndHrAdmin()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.GetHistoryDetail));
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(PlatformAdminAndHrAdmin, authorize!.Roles);
    }

    [Fact]
    public void GetSession_AllowsPlatformAdminAndHrAdmin()
    {
        var method = typeof(EmployeeImportController).GetMethod(nameof(EmployeeImportController.GetSession));
        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(authorize);
        Assert.Equal(PlatformAdminAndHrAdmin, authorize!.Roles);
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
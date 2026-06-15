using System.Security.Claims;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.CoreHR.Features.Employees.Commands.UpdateOwnEmployeeProfile;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Models.Requests;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeesControllerSelfProfileUpdateTests
{
    [Fact]
    public async Task UpdateSelfProfile_WhenLinkedToSameEmployee_SendsCommand()
    {
        var employeeId = Guid.NewGuid();
        var sender = new RecordingSender();
        var controller = CreateController(
            sender,
            employeeId,
            roles: [PlatformRole.Employee]);

        var result = await controller.UpdateSelfProfile(
            employeeId,
            new UpdateOwnEmployeeProfileRequest("Sally"),
            "\"12\"",
            CancellationToken.None);

        Assert.IsType<NoContentResult>(result);

        var command = Assert.IsType<UpdateOwnEmployeeProfileCommand>(sender.LastRequest);
        Assert.Equal(employeeId, command.EmployeeId);
        Assert.Equal((uint)12, command.ExpectedVersion);
        Assert.Equal("Sally", command.PreferredName);
    }

    [Fact]
    public async Task UpdateSelfProfile_WhenLinkedEmployeeIdDoesNotMatch_ReturnsForbid()
    {
        var controller = CreateController(
            new RecordingSender(),
            Guid.NewGuid(),
            roles: [PlatformRole.Employee]);

        var result = await controller.UpdateSelfProfile(
            Guid.NewGuid(),
            new UpdateOwnEmployeeProfileRequest("Sally"),
            "\"12\"",
            CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    private static EmployeesController CreateController(
        ISender sender,
        Guid linkedEmployeeId,
        string[] roles)
    {
        var controller = new EmployeesController(sender, new StubCoreAccessPolicyService())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                        new Claim(CustomClaimTypes.EmployeeId, linkedEmployeeId.ToString()),
                        .. roles.Select(role => new Claim(ClaimTypes.Role, role))
                    ],
                    "TestAuth"))
                }
            }
        };

        return controller;
    }

    private sealed class StubCoreAccessPolicyService : ICoreAccessPolicyService
    {
        public bool CanViewOverview(ClaimsPrincipal user) => true;
        public bool CanViewSetup(ClaimsPrincipal user) => true;
        public bool CanManageSetup(ClaimsPrincipal user) => true;
        public bool CanPublishStructure(ClaimsPrincipal user) => true;
        public bool CanViewStructure(ClaimsPrincipal user) => true;
        public bool CanManageStructure(ClaimsPrincipal user) => true;
        public bool CanViewSettings(ClaimsPrincipal user) => true;
        public bool CanManageSettings(ClaimsPrincipal user) => true;
        public bool CanViewOrganizationSettings(ClaimsPrincipal user) => true;
        public bool CanManageOrganizationSettings(ClaimsPrincipal user) => true;
        public bool CanViewPeopleDataSettings(ClaimsPrincipal user) => true;
        public bool CanManagePeopleDataSettings(ClaimsPrincipal user) => true;
        public bool CanViewStructureSettings(ClaimsPrincipal user) => true;
        public bool CanManageStructureSettings(ClaimsPrincipal user) => true;
        public bool CanViewProvisioningSettings(ClaimsPrincipal user) => true;
        public bool CanManageProvisioningSettings(ClaimsPrincipal user) => true;
        public bool CanViewGovernanceSettings(ClaimsPrincipal user) => true;
        public bool CanViewAccessProfiles(ClaimsPrincipal user) => true;
        public bool CanManageAccessProfiles(ClaimsPrincipal user) => true;
        public bool CanViewOrgChart(ClaimsPrincipal user) => true;
        public bool CanViewAccess(ClaimsPrincipal user) => true;
        public bool CanManageAccess(ClaimsPrincipal user) => true;
        public bool CanViewTenantEmployees(ClaimsPrincipal user) => true;
        public bool CanManageEmployees(ClaimsPrincipal user) => true;
        public bool CanImportEmployees(ClaimsPrincipal user) => true;
        public bool CanManageReporting(ClaimsPrincipal user) => true;
        public bool CanViewOwnProfile(ClaimsPrincipal user) => true;
        public bool CanUpdateOwnProfile(ClaimsPrincipal user) => true;
        public bool CanViewTeam(ClaimsPrincipal user) => true;
        public EmployeeReadAudience GetEmployeeReadAudience(ClaimsPrincipal user) => EmployeeReadAudience.Employee;
        public string? GetEmployeeViewScope(ClaimsPrincipal user) => PermissionScopes.Self;
    }

    private sealed class RecordingSender : ISender
    {
        public object? LastRequest { get; private set; }

        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
        {
            LastRequest = request;
            return Task.FromResult<object?>(null);
        }

        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            LastRequest = request;

            if (typeof(TResponse) == typeof(Result))
            {
                return Task.FromResult((TResponse)(object)Result.Success());
            }

            throw new NotSupportedException($"Unsupported response type: {typeof(TResponse).Name}");
        }

        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default)
            where TRequest : IRequest
        {
            LastRequest = request;
            return Task.CompletedTask;
        }

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }
}

using System.Security.Claims;
using System.Reflection;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Queries.GetEmployeeById;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeesControllerReadAuthorizationTests
{
    [Theory]
    [InlineData(nameof(EmployeesController.GetReportingLines))]
    public void LinkedEmployeeReadEndpoints_DoNotUseMethodRoleAttributes(string methodName)
    {
        var method = typeof(EmployeesController).GetMethod(methodName, [typeof(Guid), typeof(CancellationToken)]);

        var authorize = method?.GetCustomAttribute<AuthorizeAttribute>(inherit: false);

        Assert.NotNull(method);
        Assert.True(authorize is null || string.IsNullOrWhiteSpace(authorize.Roles));
    }

    [Fact]
    public async Task GetById_WhenOwnProfilePermissionMatchesLinkedEmployee_AllowsRead()
    {
        var employeeId = Guid.NewGuid();
        var sender = new Mock<ISender>();
        sender.Setup(x => x.Send(
                It.IsAny<GetEmployeeByIdQuery>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure<EmployeeDetailsDto>(
                new Error("Employee.NotFound", "Not found after authorization.")));
        var policy = CreatePolicy(canViewOwnProfile: true);
        var controller = CreateController(sender.Object, policy.Object, employeeId);

        var result = await controller.GetById(employeeId, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
        sender.Verify(x => x.Send(
            It.Is<GetEmployeeByIdQuery>(query => query.EmployeeId == employeeId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetById_WhenOwnProfileTargetsAnotherEmployee_ReturnsForbid()
    {
        var sender = new Mock<ISender>();
        var policy = CreatePolicy(canViewOwnProfile: true);
        var controller = CreateController(sender.Object, policy.Object, Guid.NewGuid());

        var result = await controller.GetById(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
        sender.VerifyNoOtherCalls();
    }

    private static Mock<ICoreAccessPolicyService> CreatePolicy(bool canViewOwnProfile)
    {
        var policy = new Mock<ICoreAccessPolicyService>();
        policy.Setup(x => x.CanViewTenantEmployees(It.IsAny<ClaimsPrincipal>())).Returns(false);
        policy.Setup(x => x.CanViewOwnProfile(It.IsAny<ClaimsPrincipal>())).Returns(canViewOwnProfile);
        return policy;
    }

    private static EmployeesController CreateController(
        ISender sender,
        ICoreAccessPolicyService policy,
        Guid linkedEmployeeId)
        => new(sender, policy)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                        new Claim(CustomClaimTypes.EmployeeId, linkedEmployeeId.ToString())
                    ], "TestAuth"))
                }
            }
        };
}

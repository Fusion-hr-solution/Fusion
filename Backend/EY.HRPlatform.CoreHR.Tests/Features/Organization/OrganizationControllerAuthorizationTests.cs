using System.Security.Claims;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.CoreHR.Features.Organization;
using EY.HRPlatform.CoreHR.Features.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace EY.HRPlatform.CoreHR.Tests.Features.Organization;

public sealed class OrganizationControllerAuthorizationTests
{
    [Fact]
    public async Task Readiness_denies_a_caller_without_organization_view()
    {
        var service = new Mock<IOrganizationService>();
        var policy = new Mock<ICoreAccessPolicyService>();
        policy.Setup(item => item.CanViewOrganization(It.IsAny<ClaimsPrincipal>())).Returns(false);
        var controller = CreateController(service.Object, policy.Object);

        var result = await controller.GetReadiness(default);

        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task Readiness_uses_organization_view_capability()
    {
        var service = new Mock<IOrganizationService>();
        service.Setup(item => item.GetReadinessAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OrganizationReadinessDto(true, null, true, Guid.NewGuid(), DateOnly.FromDateTime(DateTime.UtcNow), true));
        var policy = new Mock<ICoreAccessPolicyService>();
        policy.Setup(item => item.CanViewOrganization(It.IsAny<ClaimsPrincipal>())).Returns(true);
        var controller = CreateController(service.Object, policy.Object);

        var result = await controller.GetReadiness(default);

        Assert.IsType<OkObjectResult>(result.Result);
        policy.Verify(item => item.CanManageOrganization(It.IsAny<ClaimsPrincipal>()), Times.Never);
    }

    private static OrganizationController CreateController(IOrganizationService service, ICoreAccessPolicyService policy)
        => new(service, policy)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity("test")),
                },
            },
        };
}

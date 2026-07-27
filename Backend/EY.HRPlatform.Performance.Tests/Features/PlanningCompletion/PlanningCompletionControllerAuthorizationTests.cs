using EY.HRPlatform.Performance.Controllers;
using EY.HRPlatform.Performance.Features.PlanningCompletion.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace EY.HRPlatform.Performance.Tests.Features.PlanningCompletion;

public sealed class PlanningCompletionControllerAuthorizationTests
{
    [Fact]
    public async Task GetWorkspace_WhenUserCannotView_DeniesBeforeQueryDispatch()
    {
        var sender = new Mock<ISender>(MockBehavior.Strict);
        var access = new Mock<IPerformanceAccessPolicyService>(MockBehavior.Strict);
        access.Setup(item => item.CanViewCycles(It.IsAny<System.Security.Claims.ClaimsPrincipal>())).Returns(false);
        var controller = new PlanningCompletionController(sender.Object, access.Object);

        var result = await controller.GetWorkspace(
            "fy26-planning",
            null,
            null,
            null,
            null,
            null,
            null,
            cancellationToken: CancellationToken.None);

        AssertDenied(result);
        sender.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task RecordReminder_WhenUserCannotManage_DeniesBeforeCommandDispatch()
    {
        var sender = new Mock<ISender>(MockBehavior.Strict);
        var access = new Mock<IPerformanceAccessPolicyService>(MockBehavior.Strict);
        access.Setup(item => item.CanManageCycles(It.IsAny<System.Security.Claims.ClaimsPrincipal>())).Returns(false);
        var controller = new PlanningCompletionController(sender.Object, access.Object);

        var result = await controller.RecordReminder(
            Guid.NewGuid(),
            new RecordPlanningReminderRequest(Guid.NewGuid(), "Participant", "Follow up"),
            CancellationToken.None);

        AssertDenied(result);
        sender.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ReassignExcludeAndLock_RequireManageOrOperateBeforeCommandDispatch()
    {
        var sender = new Mock<ISender>(MockBehavior.Strict);
        var access = new Mock<IPerformanceAccessPolicyService>(MockBehavior.Strict);
        access.Setup(item => item.CanManageCycles(It.IsAny<System.Security.Claims.ClaimsPrincipal>())).Returns(false);
        access.Setup(item => item.CanOperateCycles(It.IsAny<System.Security.Claims.ClaimsPrincipal>())).Returns(false);
        var controller = new PlanningCompletionController(sender.Object, access.Object);
        var cycleId = Guid.NewGuid();
        var participantId = Guid.NewGuid();

        var reassign = await controller.ReassignReviewer(
            cycleId,
            participantId,
            new ReassignPlanningReviewerRequest(Guid.NewGuid(), "Reviewer unavailable"),
            CancellationToken.None);
        var exclude = await controller.ExcludeParticipant(
            cycleId,
            participantId,
            new ExcludePlanningParticipantRequest("Transferred"),
            CancellationToken.None);
        var lockPlanning = await controller.LockPlanning(
            cycleId,
            "\"7\"",
            new LockPlanningRequest("LOCK"),
            CancellationToken.None);

        AssertDenied(reassign);
        AssertDenied(exclude);
        AssertDenied(lockPlanning);
        sender.VerifyNoOtherCalls();
    }

    /// <summary>
    /// A denial is a 403 problem carrying a code, and its message discloses nothing about whether
    /// the target record exists.
    /// </summary>
    private static void AssertDenied(IActionResult result)
    {
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, objectResult.StatusCode);

        var problem = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.Equal("Performance.Forbidden", problem.Extensions["code"]);
        Assert.DoesNotContain("not found", problem.Detail ?? string.Empty, StringComparison.OrdinalIgnoreCase);
    }
}

using EY.HRPlatform.Performance.Models.Responses;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Mvc;

namespace EY.HRPlatform.Performance.Controllers;

/// <summary>
/// The single failure path for every Performance endpoint (design D7).
/// </summary>
/// <remarks>
/// Each controller previously carried its own <c>MapFailure</c>, and they had drifted — different
/// status choices for the same class of error, and in one case matching on message text. Routing
/// them all through here means the internal <see cref="Error.Code"/> reaches the wire intact and one
/// change fixes every endpoint.
/// </remarks>
[ApiController]
public abstract class PerformanceControllerBase : ControllerBase
{
    /// <summary>Renders an internal failure as an RFC 7807 problem carrying its code.</summary>
    protected IActionResult Problem(Error error)
        => PerformanceProblem.From(HttpContext, error);

    /// <summary>Renders a failure the caller must fix, with an explicit status.</summary>
    protected IActionResult Problem(int statusCode, string code, string message, object? details = null)
        => PerformanceProblem.Create(HttpContext, statusCode, code, message, details);

    /// <summary>
    /// A denial. Deliberately discloses nothing about whether the target exists — the message is the
    /// same whether the record is absent, another tenant's, or simply not the caller's to see.
    /// </summary>
    protected IActionResult Denied()
        => Problem(
            StatusCodes.Status403Forbidden,
            "Performance.Forbidden",
            "You do not have access to this.");

    /// <summary>A write that requires the caller's current version and did not carry one.</summary>
    protected IActionResult MissingPrecondition()
        => Problem(
            StatusCodes.Status428PreconditionRequired,
            "Performance.PreconditionRequired",
            "Provide the record's current version in the If-Match header.");
}

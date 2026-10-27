using System.ComponentModel.DataAnnotations;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.OrgChart;

// --- Contracts ------------------------------------------------------------------------------------

/// <summary>
/// An open role in a manager's line. A new role starts Open or On hold; Filled and Closed take it off the chart.
/// <paramref name="TargetStartDate"/> may be left empty; when set on a new role it can't be in the past.
/// </summary>
public sealed record OpenRoleRequest(
    [MaxLength(OpenRole.MaxJobTitleLength)] string JobTitle,
    string ManagerKey,
    Guid OrgUnitId,
    DateOnly? TargetStartDate = null,
    OpenRoleStatus Status = OpenRoleStatus.Open);

/// <summary>An open role as the chart draws it: a dashed Hiring card under <paramref name="ManagerKey"/>.</summary>
public sealed record OrgChartOpenRoleDto(
    Guid Id,
    string JobTitle,
    string ManagerKey,
    OrgChartUnitDto? Unit,
    DateOnly? TargetStartDate,
    OpenRoleStatus Status);

public sealed record CreateOpenRoleCommand(OpenRoleRequest Request, string Actor) : ICommand<Result<OrgChartOpenRoleDto>>;

public sealed record UpdateOpenRoleCommand(Guid Id, OpenRoleRequest Request, string Actor) : ICommand<Result<OrgChartOpenRoleDto>>;

public static class OpenRoleErrors
{
    public const string NotFoundCode = "OpenRole.NotFound";
}

// --- Handlers -------------------------------------------------------------------------------------

public sealed class CreateOpenRoleCommandHandler(CoreHRDbContext dbContext, ITenantContext tenantContext)
    : ICommandHandler<CreateOpenRoleCommand, Result<OrgChartOpenRoleDto>>
{
    public async Task<Result<OrgChartOpenRoleDto>> Handle(CreateOpenRoleCommand command, CancellationToken cancellationToken)
    {
        var request = command.Request;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (request.Status is not (OpenRoleStatus.Open or OpenRoleStatus.OnHold))
            return OpenRoleSupport.Invalid("OpenRole.Status", "A new role is open or on hold.");
        if (request.TargetStartDate is { } start && start < today)
            return OpenRoleSupport.Invalid("OpenRole.TargetStart", "Pick a target start from today on.");

        var placement = await OpenRoleSupport.ResolveAsync(dbContext, request, today, cancellationToken);
        if (placement.IsFailure)
            return Result.Failure<OrgChartOpenRoleDto>(placement.Error);

        var role = OpenRole.Create(tenantContext.TenantId, request.JobTitle, placement.Value.ManagerId, request.OrgUnitId,
            request.TargetStartDate, request.Status, command.Actor);
        dbContext.OpenRoles.Add(role);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success(await OpenRoleSupport.ProjectAsync(dbContext, role, placement.Value.ManagerKey, today, cancellationToken));
    }
}

public sealed class UpdateOpenRoleCommandHandler(CoreHRDbContext dbContext)
    : ICommandHandler<UpdateOpenRoleCommand, Result<OrgChartOpenRoleDto>>
{
    public async Task<Result<OrgChartOpenRoleDto>> Handle(UpdateOpenRoleCommand command, CancellationToken cancellationToken)
    {
        // The tenant query filter makes another tenant's role not found.
        var role = await dbContext.OpenRoles.FirstOrDefaultAsync(item => item.Id == command.Id, cancellationToken);
        if (role is null)
            return Result.Failure<OrgChartOpenRoleDto>(new Error(OpenRoleErrors.NotFoundCode, "Not found."));

        var request = command.Request;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (!Enum.IsDefined(request.Status))
            return OpenRoleSupport.Invalid("OpenRole.Status", "Unknown status.");
        if (request.TargetStartDate is { } start && start < today && start != role.TargetStartDate)
            return OpenRoleSupport.Invalid("OpenRole.TargetStart", "Pick a target start from today on.");

        var placement = await OpenRoleSupport.ResolveAsync(dbContext, request, today, cancellationToken);
        if (placement.IsFailure)
            return Result.Failure<OrgChartOpenRoleDto>(placement.Error);

        role.Update(request.JobTitle, placement.Value.ManagerId, request.OrgUnitId, request.TargetStartDate, request.Status, command.Actor);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success(await OpenRoleSupport.ProjectAsync(dbContext, role, placement.Value.ManagerKey, today, cancellationToken));
    }
}

internal static class OpenRoleSupport
{
    public static Result<OrgChartOpenRoleDto> Invalid(string code, string message)
        => Result.Failure<OrgChartOpenRoleDto>(Error.Validation(code, message));

    /// <summary>
    /// The manager must be employed in this tenant today and the unit active in it today. Both reads run inside the
    /// tenant query filter, so another tenant's person or unit is refused like one that doesn't exist.
    /// </summary>
    public static async Task<Result<(Guid ManagerId, string ManagerKey)>> ResolveAsync(
        CoreHRDbContext dbContext, OpenRoleRequest request, DateOnly today, CancellationToken cancellationToken)
    {
        var title = request.JobTitle?.Trim() ?? string.Empty;
        if (title.Length == 0 || title.Length > OpenRole.MaxJobTitleLength)
            return Fail("OpenRole.JobTitle", "Give the role a job title of up to 200 characters.");

        var key = (request.ManagerKey ?? string.Empty).Trim().ToUpperInvariant();
        var at = today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var manager = await dbContext.Employees.AsNoTracking()
            .Where(item => item.StableEmployeeKey == key)
            .Select(item => new { item.Id, item.StableEmployeeKey })
            .FirstOrDefaultAsync(cancellationToken);
        var employed = manager is not null && await dbContext.Employments.AsNoTracking()
            .AnyAsync(item => item.EmployeeId == manager.Id && item.EffectiveFrom <= at && (item.EffectiveTo == null || at < item.EffectiveTo), cancellationToken);
        if (!employed)
            return Fail("OpenRole.Manager", "Pick a manager who works here today.");

        var unitActive = await dbContext.OrgUnitEffectiveStates.AsNoTracking()
            .AnyAsync(state => state.OrgUnitId == request.OrgUnitId && state.LifecycleState == OrgUnitLifecycleState.Active
                && state.EffectiveFrom <= today && (state.EffectiveTo == null || today < state.EffectiveTo), cancellationToken);
        if (!unitActive)
            return Fail("OpenRole.Unit", "Pick a unit that is active today.");

        return Result.Success((manager!.Id, manager.StableEmployeeKey));

        static Result<(Guid, string)> Fail(string code, string message) => Result.Failure<(Guid, string)>(Error.Validation(code, message));
    }

    public static async Task<OrgChartOpenRoleDto> ProjectAsync(
        CoreHRDbContext dbContext, OpenRole role, string managerKey, DateOnly today, CancellationToken cancellationToken)
    {
        var units = await OrgChartQueryHandler.LoadUnitsAsync(dbContext, today, cancellationToken);
        return new OrgChartOpenRoleDto(role.Id, role.JobTitle, managerKey, units.GetValueOrDefault(role.OrgUnitId), role.TargetStartDate, role.Status);
    }
}

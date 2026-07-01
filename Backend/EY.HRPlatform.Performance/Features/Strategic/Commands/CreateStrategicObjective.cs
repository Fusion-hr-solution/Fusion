using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Strategic.Commands;

public sealed record CreateStrategicObjectiveCommand(
    Guid PeriodId,
    string OrgScope,
    string Title,
    string? Description) : ICommand<Result<Guid>>;

public sealed class CreateStrategicObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    ITenantContext tenantContext,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor) : ICommandHandler<CreateStrategicObjectiveCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateStrategicObjectiveCommand request, CancellationToken cancellationToken)
    {
        // D-05: deny-by-default — explicit permission required, never auto-granted by position
        if (!accessPolicy.CanManageStrategicObjectives(httpContextAccessor.HttpContext!.User))
            return Result.Failure<Guid>(Error.Forbidden("Strategic.Forbidden", "You do not have permission to manage strategic objectives."));

        // Validate that the referenced period exists (tenant-filtered by DbContext)
        var period = await dbContext.StrategicPeriods
            .SingleOrDefaultAsync(p => p.Id == request.PeriodId, cancellationToken);
        if (period is null)
            return Result.Failure<Guid>(Error.NotFound("StrategicPeriod", request.PeriodId));

        var tenantId = tenantContext.TenantId;

        try
        {
            var objective = StrategicObjective.Create(
                tenantId,
                request.PeriodId,
                request.OrgScope,
                request.Title,
                request.Description);

            dbContext.StrategicObjectives.Add(objective);
            await dbContext.SaveChangesAsync(cancellationToken);
            return objective.Id;
        }
        catch (ArgumentException ex)
        {
            return Result.Failure<Guid>(Error.Validation("Strategic.InvalidInput", ex.Message));
        }
    }
}

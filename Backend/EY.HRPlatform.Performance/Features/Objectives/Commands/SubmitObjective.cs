using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Objectives.Commands;

public sealed record CreateObjectiveCommand(
    Guid CycleId,
    string Title,
    string? Description,
    string SuccessMeasure,
    string Target,
    DateTime DueDate,
    decimal? Weight,
    Guid? ParentObjectiveId) : ICommand<Result<Guid>>;

public sealed class CreateObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<CreateObjectiveCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CreateObjectiveCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<Guid>(Error.Forbidden("Objective.EmployeeContextRequired", "An employee context is required to create an objective."));

        var cycle = await dbContext.PerformanceCycles
            .SingleOrDefaultAsync(item => item.Id == request.CycleId, cancellationToken);
        if (cycle is null)
            return Result.Failure<Guid>(Error.NotFound("PerformanceCycle", request.CycleId));
        if (cycle.Status != Domain.Enums.PerformanceCycleStatus.Active)
            return Result.Failure<Guid>(Error.Conflict("Objective.CycleNotActive", "Objectives can only be created in an active campaign."));
        if (request.DueDate > cycle.PeriodEnd)
            return Result.Failure<Guid>(Error.Validation("Objective.DueDateOutsideCycle", "Objective due date must fall within the campaign period."));

        var planningTaskExists = await dbContext.CampaignWorkItems.AnyAsync(item =>
            item.CycleId == cycle.Id &&
            item.AssigneeEmployeeId == currentUser.EmployeeId.Value &&
            item.SubjectEmployeeId == currentUser.EmployeeId.Value &&
            item.Type == Domain.Enums.CampaignWorkItemType.ObjectivePlanning &&
            (item.Status == Domain.Enums.CampaignWorkItemStatus.Assigned ||
             item.Status == Domain.Enums.CampaignWorkItemStatus.InProgress),
            cancellationToken);
        if (!planningTaskExists)
            return Result.Failure<Guid>(Error.Forbidden("Objective.PlanningNotAssigned", "The current employee is not assigned objective planning work for this campaign."));

        var objective = Domain.Entities.PerformanceObjective.Create(
            cycle.TenantId,
            cycle.Id,
            Domain.Enums.ObjectiveLevel.Individual,
            currentUser.EmployeeId.Value,
            request.Title,
            request.Description,
            request.SuccessMeasure,
            request.Target,
            request.DueDate,
            request.Weight,
            request.ParentObjectiveId);
        dbContext.PerformanceObjectives.Add(objective);
        await dbContext.SaveChangesAsync(cancellationToken);
        return objective.Id;
    }
}

public sealed record SubmitObjectiveCommand(Guid ObjectiveId) : ICommand<Result>;

public sealed class SubmitObjectiveCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<SubmitObjectiveCommand, Result>
{
    public async Task<Result> Handle(SubmitObjectiveCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure(Error.Forbidden("Objective.EmployeeContextRequired", "An employee context is required to submit an objective."));

        var objective = await dbContext.PerformanceObjectives
            .SingleOrDefaultAsync(item => item.Id == request.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure(Error.NotFound("PerformanceObjective", request.ObjectiveId));
        if (objective.OwnerEmployeeId != currentUser.EmployeeId.Value)
            return Result.Failure(Error.Forbidden("Objective.NotOwner", "Only the objective owner can submit this objective."));

        try
        {
            objective.Submit(DateTime.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure(Error.Conflict("Objective.InvalidTransition", exception.Message));
        }
    }
}

public enum ObjectiveApprovalDecision
{
    Approve,
    Return,
    Reject
}

public sealed record DecideObjectiveApprovalCommand(
    Guid ObjectiveId,
    Guid WorkItemId,
    ObjectiveApprovalDecision Decision) : ICommand<Result>;

public sealed class DecideObjectiveApprovalCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<DecideObjectiveApprovalCommand, Result>
{
    public async Task<Result> Handle(DecideObjectiveApprovalCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure(Error.Forbidden("Objective.EmployeeContextRequired", "An employee context is required to decide an objective approval."));

        var objective = await dbContext.PerformanceObjectives
            .SingleOrDefaultAsync(item => item.Id == request.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure(Error.NotFound("PerformanceObjective", request.ObjectiveId));

        var workItem = await dbContext.CampaignWorkItems
            .SingleOrDefaultAsync(item => item.Id == request.WorkItemId, cancellationToken);
        if (workItem is null)
            return Result.Failure(Error.NotFound("CampaignWorkItem", request.WorkItemId));
        if (workItem.Type != Domain.Enums.CampaignWorkItemType.ObjectiveApproval ||
            workItem.CycleId != objective.CycleId ||
            workItem.SubjectEmployeeId != objective.OwnerEmployeeId ||
            workItem.AssigneeEmployeeId != currentUser.EmployeeId.Value)
        {
            return Result.Failure(Error.Forbidden("Objective.ApprovalNotAssigned", "The current employee is not assigned to approve this objective."));
        }

        try
        {
            switch (request.Decision)
            {
                case ObjectiveApprovalDecision.Approve:
                    objective.Approve(DateTime.UtcNow);
                    break;
                case ObjectiveApprovalDecision.Return:
                    objective.Return(DateTime.UtcNow);
                    break;
                case ObjectiveApprovalDecision.Reject:
                    objective.Reject(DateTime.UtcNow);
                    break;
                default:
                    return Result.Failure(Error.Validation("Objective.InvalidApprovalDecision", "An approval decision is required."));
            }

            workItem.Submit(DateTime.UtcNow);
            workItem.Complete(DateTime.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure(Error.Conflict("Objective.InvalidTransition", exception.Message));
        }
    }
}

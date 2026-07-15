using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class UpdateTrainingCommandHandler : ICommandHandler<UpdateTrainingCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateTrainingCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateTrainingCommand request, CancellationToken cancellationToken)
    {
        var training = await _db.Trainings
            .FirstOrDefaultAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (training is null)
            return Result.Failure(Error.NotFound("Training", request.TrainingId));

        if (!Enum.TryParse<BadgeLevel>(request.BadgeLevel, true, out var badgeLevel))
            return Result.Failure(Error.Validation("Training.InvalidBadgeLevel",
                $"Invalid badge level '{request.BadgeLevel}'. Valid values: Bronze, Silver, Gold."));

        var categoryExists = await _db.Categories
            .AnyAsync(c => c.Id == request.CategoryId, cancellationToken);

        if (!categoryExists)
            return Result.Failure(Error.NotFound("Category", request.CategoryId));

        TrainingType? parsedType = null;
        if (!string.IsNullOrEmpty(request.TrainingType))
        {
            if (!Enum.TryParse<TrainingType>(request.TrainingType, true, out var tt))
                return Result.Failure(Error.Validation("Training.InvalidTrainingType",
                    $"Invalid training type '{request.TrainingType}'. Valid values: ELearning, OnSite."));
            parsedType = tt;
        }

        CostType? parsedCostType = null;
        if (!string.IsNullOrEmpty(request.CostType))
        {
            if (!Enum.TryParse<CostType>(request.CostType, true, out var ct))
                return Result.Failure(Error.Validation("Training.InvalidCostType",
                    $"Invalid cost type '{request.CostType}'. Valid values: Internal, External."));
            parsedCostType = ct;
        }

        // Validate against the effective (post-update) cost type + training type.
        var effectiveCostType = parsedCostType ?? training.CostType;
        var effectiveType = parsedType ?? training.TrainingType;
        if (effectiveCostType == CostType.External)
        {
            if (effectiveType != TrainingType.OnSite)
                return Result.Failure(Error.Validation("Training.CostTypeRequiresOnSite",
                    "External cost type is only valid for OnSite trainings."));
            if (request.SponsoringServiceLineId is null)
                return Result.Failure(Error.Validation("Training.SponsorRequired",
                    "A sponsoring service line is required for External OnSite trainings."));
            var sponsorExists = await _db.ServiceLines
                .AnyAsync(s => s.Id == request.SponsoringServiceLineId.Value, cancellationToken);
            if (!sponsorExists)
                return Result.Failure(Error.NotFound("ServiceLine", request.SponsoringServiceLineId.Value));
        }

        training.Update(request.Title, request.Description, request.Credits,
            request.IsMandatory, badgeLevel, request.Duration, parsedType, request.ScheduledDate,
            parsedCostType,
            effectiveCostType == CostType.External ? request.SponsoringServiceLineId : null);

        if (training.CategoryId != request.CategoryId)
            training.UpdateCategory(request.CategoryId);

        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

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

        training.Update(request.Title, request.Description, request.Credits,
            request.IsMandatory, badgeLevel, request.Duration);

        if (training.CategoryId != request.CategoryId)
            training.UpdateCategory(request.CategoryId);

        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class DeleteCategoryCommandHandler : ICommandHandler<DeleteCategoryCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeleteCategoryCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await _db.Categories
            .Include(c => c.Trainings)
            .FirstOrDefaultAsync(c => c.Id == request.CategoryId, cancellationToken);

        if (category is null)
            return Result.Failure(Error.NotFound("Category", request.CategoryId));

        if (category.Trainings.Any())
            return Result.Failure(Error.Validation("Category.HasTrainings",
                "Cannot delete a category that still has trainings. Reassign or delete them first."));

        _db.Categories.Remove(category);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

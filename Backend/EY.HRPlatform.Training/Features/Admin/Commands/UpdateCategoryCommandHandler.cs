using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class UpdateCategoryCommandHandler : ICommandHandler<UpdateCategoryCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateCategoryCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await _db.Categories
            .FirstOrDefaultAsync(c => c.Id == request.CategoryId, cancellationToken);

        if (category is null)
            return Result.Failure(Error.NotFound("Category", request.CategoryId));

        var duplicate = await _db.Categories
            .AnyAsync(c => c.Name == request.Name && c.Id != request.CategoryId, cancellationToken);

        if (duplicate)
            return Result.Failure(Error.Conflict("Category.Duplicate",
                $"A category with name '{request.Name}' already exists."));

        category.Update(request.Name, request.Description);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

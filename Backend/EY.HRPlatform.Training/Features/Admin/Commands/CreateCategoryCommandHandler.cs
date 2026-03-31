using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class CreateCategoryCommandHandler : ICommandHandler<CreateCategoryCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public CreateCategoryCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(CreateCategoryCommand request, CancellationToken cancellationToken)
    {
        var exists = await _db.Categories
            .AnyAsync(c => c.Name == request.Name, cancellationToken);

        if (exists)
            return Result.Failure<Guid>(Error.Conflict("Category.Duplicate",
                $"A category with name '{request.Name}' already exists."));

        var category = new TrainingCategory(request.Name, request.Description);
        _db.Categories.Add(category);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(category.Id);
    }
}

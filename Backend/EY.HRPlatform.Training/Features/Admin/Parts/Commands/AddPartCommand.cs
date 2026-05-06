using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Parts.Commands;

public record AddPartCommand(
    Guid TrainingId,
    string Title,
    string? Description,
    decimal DurationHours) : ICommand<Result<Guid>>;

public class AddPartCommandHandler : ICommandHandler<AddPartCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public AddPartCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(AddPartCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return Result.Failure<Guid>(Error.Validation("Part.TitleRequired", "Part title is required."));

        if (request.DurationHours < 0)
            return Result.Failure<Guid>(Error.Validation("Part.InvalidDuration", "Duration must be non-negative."));

        var trainingExists = await _db.Trainings
            .AnyAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (!trainingExists)
            return Result.Failure<Guid>(Error.NotFound("Training", request.TrainingId));

        var maxIndex = await _db.TrainingParts
            .Where(p => p.TrainingId == request.TrainingId)
            .MaxAsync(p => (int?)p.OrderIndex, cancellationToken) ?? -1;

        var part = new TrainingPart(
            request.TrainingId,
            request.Title.Trim(),
            request.Description,
            maxIndex + 1,
            request.DurationHours);

        _db.TrainingParts.Add(part);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(part.Id);
    }
}

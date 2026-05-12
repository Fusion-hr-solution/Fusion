using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Parts.Commands;

public record UpdatePartCommand(
    Guid TrainingId,
    Guid PartId,
    string Title,
    string? Description,
    decimal DurationHours) : ICommand<Result>;

public class UpdatePartCommandHandler : ICommandHandler<UpdatePartCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdatePartCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdatePartCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return Result.Failure(Error.Validation("Part.TitleRequired", "Part title is required."));

        if (request.DurationHours < 0)
            return Result.Failure(Error.Validation("Part.InvalidDuration", "Duration must be non-negative."));

        var part = await _db.TrainingParts
            .FirstOrDefaultAsync(p => p.Id == request.PartId && p.TrainingId == request.TrainingId, cancellationToken);

        if (part is null)
            return Result.Failure(Error.NotFound("TrainingPart", request.PartId));

        part.Update(request.Title.Trim(), request.Description, request.DurationHours);
        await _db.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}

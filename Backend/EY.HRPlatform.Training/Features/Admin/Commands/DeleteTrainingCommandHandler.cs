using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class DeleteTrainingCommandHandler : ICommandHandler<DeleteTrainingCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeleteTrainingCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteTrainingCommand request, CancellationToken cancellationToken)
    {
        var training = await _db.Trainings
            .FirstOrDefaultAsync(t => t.Id == request.TrainingId, cancellationToken);

        if (training is null)
            return Result.Failure(Error.NotFound("Training", request.TrainingId));

        training.Delete();
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

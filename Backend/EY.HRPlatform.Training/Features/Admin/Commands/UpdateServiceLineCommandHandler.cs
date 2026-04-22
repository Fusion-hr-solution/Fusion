using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class UpdateServiceLineCommandHandler : ICommandHandler<UpdateServiceLineCommand, Result>
{
    private readonly TrainingDbContext _db;

    public UpdateServiceLineCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(UpdateServiceLineCommand request, CancellationToken cancellationToken)
    {
        var serviceLine = await _db.ServiceLines
            .FirstOrDefaultAsync(s => s.Id == request.ServiceLineId, cancellationToken);

        if (serviceLine is null)
            return Result.Failure(Error.NotFound("ServiceLine", request.ServiceLineId));

        var nameTaken = await _db.ServiceLines
            .AnyAsync(s => s.Name == request.Name && s.Id != request.ServiceLineId, cancellationToken);

        if (nameTaken)
            return Result.Failure(Error.Conflict("ServiceLine.Duplicate",
                $"A service line with name '{request.Name}' already exists."));

        var codeTaken = await _db.ServiceLines
            .AnyAsync(s => s.Code == request.Code && s.Id != request.ServiceLineId, cancellationToken);

        if (codeTaken)
            return Result.Failure(Error.Conflict("ServiceLine.CodeDuplicate",
                $"A service line with code '{request.Code}' already exists."));

        serviceLine.Update(request.Name, request.Code, request.Color,
            request.Description, request.IsSharedAcrossAllServiceLines);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class CreateServiceLineCommandHandler : ICommandHandler<CreateServiceLineCommand, Result<Guid>>
{
    private readonly TrainingDbContext _db;

    public CreateServiceLineCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<Guid>> Handle(CreateServiceLineCommand request, CancellationToken cancellationToken)
    {
        var nameTaken = await _db.ServiceLines
            .AnyAsync(s => s.Name == request.Name, cancellationToken);

        if (nameTaken)
            return Result.Failure<Guid>(Error.Conflict("ServiceLine.Duplicate",
                $"A service line with name '{request.Name}' already exists."));

        var codeTaken = await _db.ServiceLines
            .AnyAsync(s => s.Code == request.Code, cancellationToken);

        if (codeTaken)
            return Result.Failure<Guid>(Error.Conflict("ServiceLine.CodeDuplicate",
                $"A service line with code '{request.Code}' already exists."));

        var serviceLine = new ServiceLine(
            request.Name, request.Code, request.Color,
            request.Description, request.IsSharedAcrossAllServiceLines);

        _db.ServiceLines.Add(serviceLine);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success(serviceLine.Id);
    }
}

using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class DeleteContentBlockCommandHandler : ICommandHandler<DeleteContentBlockCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeleteContentBlockCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteContentBlockCommand request, CancellationToken cancellationToken)
    {
        var block = await _db.ContentBlocks
            .Include(b => b.Chapter)
            .FirstOrDefaultAsync(b => b.Id == request.ContentBlockId
                                   && b.ChapterId == request.ChapterId
                                   && b.Chapter.TrainingId == request.TrainingId,
                cancellationToken);

        if (block is null)
            return Result.Failure(Error.NotFound("ContentBlock", request.ContentBlockId));

        _db.ContentBlocks.Remove(block);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

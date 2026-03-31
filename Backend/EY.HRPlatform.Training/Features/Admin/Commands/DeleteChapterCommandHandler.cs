using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public class DeleteChapterCommandHandler : ICommandHandler<DeleteChapterCommand, Result>
{
    private readonly TrainingDbContext _db;

    public DeleteChapterCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(DeleteChapterCommand request, CancellationToken cancellationToken)
    {
        var chapter = await _db.Chapters
            .FirstOrDefaultAsync(c => c.Id == request.ChapterId && c.TrainingId == request.TrainingId,
                cancellationToken);

        if (chapter is null)
            return Result.Failure(Error.NotFound("Chapter", request.ChapterId));

        _db.Chapters.Remove(chapter);
        await _db.SaveChangesAsync(cancellationToken);

        return Result.Success();
    }
}

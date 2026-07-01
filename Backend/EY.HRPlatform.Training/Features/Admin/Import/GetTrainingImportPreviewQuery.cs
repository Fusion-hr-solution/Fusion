using System.Text.Json;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Import;

/// <summary>US-8.2.3 — re-read a staged import preview by session id (scoped to its creator).</summary>
public record GetTrainingImportPreviewQuery(Guid SessionId, Guid EmployeeId)
    : IQuery<Result<TrainingImportPreviewDto>>;

public class GetTrainingImportPreviewQueryHandler
    : IQueryHandler<GetTrainingImportPreviewQuery, Result<TrainingImportPreviewDto>>
{
    private readonly TrainingDbContext _db;

    public GetTrainingImportPreviewQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<TrainingImportPreviewDto>> Handle(
        GetTrainingImportPreviewQuery request, CancellationToken cancellationToken)
    {
        var session = await _db.TrainingImportSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == request.SessionId, cancellationToken);

        if (session is null || session.CreatedByEmployeeId != request.EmployeeId)
            return Result.Failure<TrainingImportPreviewDto>(Error.NotFound("ImportSession", request.SessionId));

        if (session.IsExpired(DateTime.UtcNow))
            return Result.Failure<TrainingImportPreviewDto>(Error.Validation(
                "Import.Expired", "This import preview has expired. Please upload the file again."));

        var preview = JsonSerializer.Deserialize<TrainingImportPreviewDto>(session.PayloadJson)
                      ?? new TrainingImportPreviewDto();
        preview.SessionId = session.Id;
        preview.FileName = session.FileName;
        return Result.Success(preview);
    }
}

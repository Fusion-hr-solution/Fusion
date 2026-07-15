using System.Text.Json;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Import;

/// <summary>US-8.2.3 — parse + validate an uploaded import workbook and stage it as a preview session.</summary>
public record UploadTrainingImportCommand(byte[] FileBytes, string FileName, Guid EmployeeId)
    : ICommand<Result<TrainingImportPreviewDto>>;

public class UploadTrainingImportCommandHandler
    : ICommandHandler<UploadTrainingImportCommand, Result<TrainingImportPreviewDto>>
{
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(2);
    private const int MaxTrainings = 1000;
    private const int MaxChildRows = 20000;

    private readonly TrainingDbContext _db;

    public UploadTrainingImportCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<TrainingImportPreviewDto>> Handle(
        UploadTrainingImportCommand request, CancellationToken cancellationToken)
    {
        ParsedWorkbook parsed;
        try
        {
            using var stream = new MemoryStream(request.FileBytes);
            parsed = TrainingImportParser.Parse(stream);
        }
        catch (Exception)
        {
            return Result.Failure<TrainingImportPreviewDto>(
                Error.Validation("Import.InvalidFile", "The file could not be read as an .xlsx workbook."));
        }

        var childRows = parsed.Sessions.Count + parsed.Chapters.Count + parsed.Content.Count;
        if (parsed.Trainings.Count > MaxTrainings || childRows > MaxChildRows)
            return Result.Failure<TrainingImportPreviewDto>(Error.Validation(
                "Import.TooLarge",
                $"This workbook is too large to import in one go (limit {MaxTrainings} trainings / {MaxChildRows} child rows). Please split it."));

        var categoryNames = (await _db.Categories.AsNoTracking()
                .Select(c => c.Name).ToListAsync(cancellationToken))
            .Select(n => n.Trim().ToLowerInvariant()).ToHashSet();

        var existing = await _db.Trainings.AsNoTracking()
            .Where(t => !t.IsDeleted)
            .Select(t => new { t.Title, CategoryName = t.Category.Name })
            .ToListAsync(cancellationToken);
        var existingKeys = existing
            .Select(x => $"{x.Title.Trim().ToLowerInvariant()}|{x.CategoryName.Trim().ToLowerInvariant()}")
            .ToHashSet();

        var trainerEmails = (await _db.EmployeeProfiles.AsNoTracking()
                .Where(e => e.Email != null).Select(e => e.Email!).ToListAsync(cancellationToken))
            .Select(e => e.Trim().ToLowerInvariant()).ToHashSet();

        var ctx = new ImportValidationContext(categoryNames, existingKeys, trainerEmails);
        var preview = TrainingImportValidator.Validate(request.FileName, parsed, ctx);

        var json = JsonSerializer.Serialize(preview);
        var fileName = request.FileName.Length > 260 ? request.FileName[..260] : request.FileName;
        var session = new TrainingImportSession(
            request.EmployeeId, fileName, json, DateTime.UtcNow.Add(SessionLifetime));
        _db.TrainingImportSessions.Add(session);
        await _db.SaveChangesAsync(cancellationToken);

        preview.SessionId = session.Id;
        return Result.Success(preview);
    }
}

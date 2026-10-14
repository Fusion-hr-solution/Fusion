using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Features.Failures;
using EY.HRPlatform.Performance.Infrastructure.Evidence;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Progress;

public sealed record UploadEvidenceCommand(Guid CycleId, Guid ObjectiveId, IFormFile File, ProgressActorContext Actor)
    : ICommand<Result<EvidenceDescriptorDto>>;

public sealed class UploadEvidenceHandler(PerformanceDbContext db, IPerformanceEvidenceStore store)
    : ICommandHandler<UploadEvidenceCommand, Result<EvidenceDescriptorDto>>
{
    public async Task<Result<EvidenceDescriptorDto>> Handle(UploadEvidenceCommand command, CancellationToken cancellationToken)
    {
        var cycle = await db.Cycles.AsNoTracking().FirstOrDefaultAsync(c => c.Id == command.CycleId, cancellationToken);
        if (cycle is null) return Result.Failure<EvidenceDescriptorDto>(PerformanceErrors.NotFound("Cycle", command.CycleId));
        if (cycle.IsClosed) return Result.Failure<EvidenceDescriptorDto>(PerformanceErrors.InvalidState(PerformanceErrors.Codes.CycleClosed, "A Closed Cycle is read-only."));
        var objective = await db.Objectives.AsNoTracking().FirstOrDefaultAsync(o => o.Id == command.ObjectiveId && o.CycleId == cycle.Id, cancellationToken);
        if (objective is null) return Result.Failure<EvidenceDescriptorDto>(PerformanceErrors.NotFound("Objective", command.ObjectiveId));
        EmployeePlan? plan = objective.EmployeePlanId is null ? null
            : await db.EmployeePlans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == objective.EmployeePlanId, cancellationToken);
        if (!ProgressComposer.CanUpdate(objective, plan, command.Actor))
            return Result.Failure<EvidenceDescriptorDto>(PerformanceErrors.Forbidden(PerformanceErrors.Codes.EvidenceForbidden, "Only the accountable owner can attach evidence to progress."));

        var file = command.File;
        if (file is null || file.Length <= 0)
            return Invalid("A file is required.");
        if (file.Length > EvidenceFileValidation.MaxBytes)
            return Invalid("The file exceeds the 20 MB limit.");
        var fileName = Path.GetFileName(file.FileName.Replace('\\', '/'));
        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > 250)
            return Invalid("Choose a file with a shorter name.");
        if (fileName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
            return Invalid("This file name cannot be used. Rename the file and try again.");

        using var content = new MemoryStream();
        await using (var input = file.OpenReadStream())
        {
            var buffer = new byte[81920];
            int read;
            while ((read = await input.ReadAsync(buffer, cancellationToken)) > 0)
            {
                if (content.Length + read > EvidenceFileValidation.MaxBytes)
                    return Invalid("The file exceeds the 20 MB limit.");
                await content.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            }
        }
        if (content.Length == 0) return Invalid("A file is required.");
        string type;
        try { type = EvidenceFileValidation.Validate(fileName, file.ContentType, content.GetBuffer().AsSpan(0, (int)Math.Min(12, content.Length))); }
        catch (ArgumentException ex) { return Invalid(ex.Message); }
        content.Position = 0;
        var key = await store.SaveAsync(content, fileName, cancellationToken);
        try
        {
            var upload = EvidenceUpload.Stage(cycle.TenantId, cycle.Id, objective.Id, command.Actor.CallerEmployeeId,
                key, fileName, type, content.Length);
            db.EvidenceUploads.Add(upload);
            await db.SaveChangesAsync(cancellationToken);
            return new EvidenceDescriptorDto(upload.Id, upload.FileName, upload.ContentType, upload.SizeBytes);
        }
        catch
        {
            await store.DeleteAsync(key, CancellationToken.None);
            throw;
        }
    }

    private static Result<EvidenceDescriptorDto> Invalid(string message)
        => Result.Failure<EvidenceDescriptorDto>(PerformanceErrors.Validation(PerformanceErrors.Codes.EvidenceUploadInvalid, message));
}

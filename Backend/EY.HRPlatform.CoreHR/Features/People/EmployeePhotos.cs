using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.CoreHR.Infrastructure.Photos;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.People;

/// <summary>
/// Profile photos (B-129): the person or a people admin sets one; anyone who can open the profile sees it.
/// The browser crops to a square before upload; the server trusts only the bytes.
/// </summary>
public static class EmployeePhotos
{
    public const long MaxBytes = 5 * 1024 * 1024;

    /// <summary>
    /// The API-relative address of a person's photo, or null without one. The version changes with every
    /// upload, so a response for one address never goes stale and can be cached for good.
    /// </summary>
    public static string? UrlFor(string employeeKey, string? photoKey)
        => photoKey is null ? null : $"/corehr/employees/people/{Uri.EscapeDataString(employeeKey)}/photo?v={VersionOf(photoKey)}";

    public static string VersionOf(string photoKey)
    {
        var name = Path.GetFileNameWithoutExtension(photoKey[(photoKey.LastIndexOf('/') + 1)..]);
        return name.Length > 12 ? name[..12] : name;
    }

    /// <summary>Recognises JPEG, PNG and WebP by their first bytes; anything else is refused whatever it is called.</summary>
    public static (string ContentType, string Extension)? Sniff(ReadOnlySpan<byte> head)
    {
        if (head.Length >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF)
            return ("image/jpeg", ".jpg");
        if (head.Length >= 8 && head[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
            return ("image/png", ".png");
        if (head.Length >= 12 && head[..4].SequenceEqual("RIFF"u8) && head[8..12].SequenceEqual("WEBP"u8))
            return ("image/webp", ".webp");
        return null;
    }

    public static string ContentTypeOf(string photoKey) => Path.GetExtension(photoKey) switch
    {
        ".png" => "image/png",
        ".webp" => "image/webp",
        _ => "image/jpeg",
    };
}

public sealed record EmployeePhotoDto(string? PhotoUrl);

public sealed record EmployeePhotoFile(string StorageKey, string ContentType, string Version);

public sealed record UploadEmployeePhotoCommand(string EmployeeKey, PeopleViewer Viewer, IFormFile? File, string Actor)
    : ICommand<Result<EmployeePhotoDto>>;

public sealed record RemoveEmployeePhotoCommand(string EmployeeKey, PeopleViewer Viewer, string Actor)
    : ICommand<Result<EmployeePhotoDto>>;

/// <summary>The stored photo of someone in the tenant; who may look is decided at the endpoint.</summary>
public sealed record EmployeePhotoQuery(string EmployeeKey) : IQuery<Result<EmployeePhotoFile>>;

public sealed class UploadEmployeePhotoHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IEmployeePhotoStore store,
    ILogger<UploadEmployeePhotoHandler> logger)
    : ICommandHandler<UploadEmployeePhotoCommand, Result<EmployeePhotoDto>>
{
    public async Task<Result<EmployeePhotoDto>> Handle(UploadEmployeePhotoCommand command, CancellationToken cancellationToken)
    {
        var employee = await PhotoSupport.FindAsync(dbContext, command.EmployeeKey, cancellationToken);
        if (employee is null)
            return Result.Failure<EmployeePhotoDto>(new Error("Employee.NotFound", "Employee was not found."));
        if (!(await PeopleAccess.DecideAsync(dbContext, command.Viewer, employee.Id, cancellationToken)).CanEdit)
            return Result.Failure<EmployeePhotoDto>(PeopleAccess.Forbidden("You can't change this person's photo."));

        var file = command.File;
        if (file is null || file.Length <= 0)
            return Invalid("Choose a photo.");
        if (file.Length > EmployeePhotos.MaxBytes)
            return Invalid("The photo is larger than 5 MB.");

        // Read with a hard cap: the declared length is the client's word, the bytes are not.
        using var content = new MemoryStream();
        await using (var input = file.OpenReadStream())
        {
            var buffer = new byte[81920];
            int read;
            while ((read = await input.ReadAsync(buffer, cancellationToken)) > 0)
            {
                if (content.Length + read > EmployeePhotos.MaxBytes)
                    return Invalid("The photo is larger than 5 MB.");
                await content.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            }
        }
        if (content.Length == 0)
            return Invalid("Choose a photo.");
        if (EmployeePhotos.Sniff(content.GetBuffer().AsSpan(0, (int)Math.Min(12, content.Length))) is not { } type)
            return Invalid("Use a JPEG, PNG or WebP image.");

        content.Position = 0;
        var key = await store.SaveAsync(content, type.Extension, cancellationToken);
        string? previous;
        try
        {
            previous = employee.ReplacePhoto(key);
            PhotoSupport.Audit(dbContext, tenantContext, employee, command.Actor, "Photo changed.");
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await store.DeleteAsync(key, CancellationToken.None);
            throw;
        }

        await PhotoSupport.DeleteQuietlyAsync(store, previous, logger);
        return Result.Success(new EmployeePhotoDto(EmployeePhotos.UrlFor(employee.StableEmployeeKey, key)));
    }

    private static Result<EmployeePhotoDto> Invalid(string message)
        => Result.Failure<EmployeePhotoDto>(new Error("Employee.Validation", message));
}

public sealed class RemoveEmployeePhotoHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IEmployeePhotoStore store,
    ILogger<RemoveEmployeePhotoHandler> logger)
    : ICommandHandler<RemoveEmployeePhotoCommand, Result<EmployeePhotoDto>>
{
    public async Task<Result<EmployeePhotoDto>> Handle(RemoveEmployeePhotoCommand command, CancellationToken cancellationToken)
    {
        var employee = await PhotoSupport.FindAsync(dbContext, command.EmployeeKey, cancellationToken);
        if (employee is null)
            return Result.Failure<EmployeePhotoDto>(new Error("Employee.NotFound", "Employee was not found."));
        if (!(await PeopleAccess.DecideAsync(dbContext, command.Viewer, employee.Id, cancellationToken)).CanEdit)
            return Result.Failure<EmployeePhotoDto>(PeopleAccess.Forbidden("You can't change this person's photo."));
        if (employee.PhotoKey is null)
            return Result.Success(new EmployeePhotoDto(null));

        var previous = employee.RemovePhoto();
        PhotoSupport.Audit(dbContext, tenantContext, employee, command.Actor, "Photo removed.");
        await dbContext.SaveChangesAsync(cancellationToken);
        await PhotoSupport.DeleteQuietlyAsync(store, previous, logger);
        return Result.Success(new EmployeePhotoDto(null));
    }
}

public sealed class EmployeePhotoQueryHandler(CoreHRDbContext dbContext)
    : IQueryHandler<EmployeePhotoQuery, Result<EmployeePhotoFile>>
{
    public async Task<Result<EmployeePhotoFile>> Handle(EmployeePhotoQuery request, CancellationToken cancellationToken)
    {
        var key = request.EmployeeKey.Trim().ToUpperInvariant();
        var photoKey = await dbContext.Employees.AsNoTracking()
            .Where(item => item.StableEmployeeKey == key)
            .Select(item => item.PhotoKey)
            .FirstOrDefaultAsync(cancellationToken);
        return photoKey is null
            ? Result.Failure<EmployeePhotoFile>(new Error("Photo.NotFound", "No photo."))
            : Result.Success(new EmployeePhotoFile(photoKey, EmployeePhotos.ContentTypeOf(photoKey), EmployeePhotos.VersionOf(photoKey)));
    }
}

internal static class PhotoSupport
{
    public static Task<Employee?> FindAsync(CoreHRDbContext dbContext, string employeeKey, CancellationToken cancellationToken)
    {
        var key = employeeKey.Trim().ToUpperInvariant();
        return dbContext.Employees.FirstOrDefaultAsync(item => item.StableEmployeeKey == key, cancellationToken);
    }

    public static void Audit(CoreHRDbContext dbContext, ITenantContext tenantContext, Employee employee, string actor, string details)
        => dbContext.WorkforceAuditEntries.Add(WorkforceAuditEntry.Record(
            tenantContext.TenantId, "Employee", employee.Id, WorkforceAuditAction.PhotoChanged,
            WorkforceSourceType.Manual, actor, changeDetails: details));

    /// <summary>The record no longer points at the old file; failing to delete it only leaves an orphan behind.</summary>
    public static async Task DeleteQuietlyAsync(IEmployeePhotoStore store, string? storageKey, ILogger logger)
    {
        if (storageKey is null)
            return;
        try
        {
            await store.DeleteAsync(storageKey, CancellationToken.None);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException)
        {
            logger.LogWarning(ex, "Could not delete a replaced profile photo.");
        }
    }
}

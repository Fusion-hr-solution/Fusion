using System.Globalization;
using System.Text;
using System.Text.Json;
using CsvHelper;
using CsvHelper.Configuration;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

public interface IEmployeeImportWorkflowService
{
    Task<EmployeeImportSchemaDto> GetSchemaAsync(CancellationToken cancellationToken);
    Task<(byte[] Content, string FileName)> BuildTemplateAsync(CancellationToken cancellationToken);
    Task<EmployeeImportSessionDto> UploadAsync(IFormFile file, CancellationToken cancellationToken);
    Task<EmployeeImportSessionDto> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken);
}

public sealed class EmployeeImportWorkflowService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext) : IEmployeeImportWorkflowService
{
    private const int MaxSourceFileNameLength = 260;
    private const int MaxRowCount = 5000;
    private const int SampleRowCount = 12;
    private const int PreviewRowCount = 25;
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(2);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly IReadOnlyList<EmployeeImportCanonicalFieldDto> CanonicalFields =
    [
        new(
            "firstName",
            "First name",
            true,
            "Employee given name.",
            "Sarah"),
        new(
            "lastName",
            "Last name",
            true,
            "Employee family name.",
            "Chen"),
        new(
            "email",
            "Email",
            true,
            "Primary work email used as the stable employee identity.",
            "sarah.chen@contoso.com"),
        new(
            "hireDate",
            "Hire date",
            true,
            "Use ISO format YYYY-MM-DD.",
            "2024-01-15"),
        new(
            "jobTitle",
            "Job title",
            false,
            "Current title shown on the employee record.",
            "Senior Engineer"),
        new(
            "orgUnitCode",
            "Org unit code",
            false,
            "Use the code of the organization unit the employee belongs to.",
            "ENG-PLATFORM"),
        new(
            "managerEmail",
            "Manager email",
            false,
            "Employee email of the reporting manager inside the same tenant.",
            "alex.manager@contoso.com")
    ];

    public async Task<EmployeeImportSchemaDto> GetSchemaAsync(CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);
        return BuildSchema();
    }

    public async Task<(byte[] Content, string FileName)> BuildTemplateAsync(CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);

        var headerLine = string.Join(",", CanonicalFields.Select(field => field.Key));
        return (Encoding.UTF8.GetBytes($"{headerLine}\r\n"), "employee-import-template.csv");
    }

    public async Task<EmployeeImportSessionDto> UploadAsync(IFormFile file, CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);
        var sourceFileName = ValidateUpload(file);

        var parsedFile = await ParseCsvAsync(file, cancellationToken);
        EnsureTemplateHeaders(parsedFile.Headers);

        if (parsedFile.Rows.Count == 0)
        {
            throw new ArgumentException("Upload a CSV with at least one employee row.", nameof(file));
        }

        var previewRows = parsedFile.Rows
            .Select(CreatePreviewRow)
            .ToList();

        var session = EmployeeImportSession.CreatePreviewReady(
            tenantContext.TenantId,
            sourceFileName,
            file.Length,
            JsonSerializer.Serialize(parsedFile.Headers, JsonOptions),
            JsonSerializer.Serialize(parsedFile.Rows, JsonOptions),
            JsonSerializer.Serialize(previewRows, JsonOptions),
            DateTime.UtcNow.Add(SessionLifetime));

        dbContext.EmployeeImportSessions.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        return BuildSessionDto(session, parsedFile.Headers, parsedFile.Rows, previewRows);
    }

    public async Task<EmployeeImportSessionDto> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);

        var session = await dbContext.EmployeeImportSessions
            .FirstOrDefaultAsync(current => current.Id == sessionId, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(EmployeeImportSession), sessionId);

        if (session.Stage != EmployeeImportStage.Expired && session.ExpiresAt <= DateTime.UtcNow)
        {
            session.MarkExpired();
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var headers = Deserialize<List<string>>(session.SourceHeadersJson) ?? [];
        var sourceRows = Deserialize<List<EmployeeImportSourceRowDto>>(session.SourceRowsJson) ?? [];
        var previewRows = Deserialize<List<EmployeeImportPreviewRowDto>>(session.PreviewRowsJson) ?? [];

        return BuildSessionDto(session, headers, sourceRows, previewRows);
    }

    private async Task EnsureImportAvailableAsync(CancellationToken cancellationToken)
    {
        var setupState = await dbContext.TenantSetupStates
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (setupState is null || setupState.CurrentPhase < TenantSetupPhase.StructurallyPublished)
        {
            throw new InvalidTenantSetupStateException(
                "Complete setup before importing employees.");
        }
    }

    private static EmployeeImportSchemaDto BuildSchema() => new(CanonicalFields);

    private static string ValidateUpload(IFormFile? file)
    {
        if (file is null)
        {
            throw new ArgumentException("Attach the employee import CSV before uploading.", nameof(file));
        }

        if (file.Length <= 0)
        {
            throw new ArgumentException("Attach a non-empty employee import CSV.", nameof(file));
        }

        var sourceFileName = System.IO.Path.GetFileName(file.FileName).Trim();
        if (sourceFileName.Length == 0)
        {
            throw new ArgumentException("Attach an employee import CSV with a valid file name.", nameof(file));
        }

        if (sourceFileName.Length > MaxSourceFileNameLength)
        {
            throw new ArgumentException(
                $"Employee import file names must be {MaxSourceFileNameLength} characters or fewer.",
                nameof(file));
        }

        if (!sourceFileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Employee import only accepts CSV files.", nameof(file));
        }

        return sourceFileName;
    }

    private static void EnsureTemplateHeaders(IReadOnlyList<string> actualHeaders)
    {
        var expectedHeaders = CanonicalFields.Select(field => field.Key).ToArray();
        if (actualHeaders.Count != expectedHeaders.Length)
        {
            throw new ArgumentException(
                "Use the official employee import template. Column headers must match exactly in the expected order.");
        }

        for (var index = 0; index < expectedHeaders.Length; index++)
        {
            if (!string.Equals(actualHeaders[index], expectedHeaders[index], StringComparison.Ordinal))
            {
                throw new ArgumentException(
                    "Use the official employee import template. Column headers must match exactly in the expected order.");
            }
        }
    }

    private static async Task<ParsedCsvFile> ParseCsvAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var configuration = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            IgnoreBlankLines = true,
            PrepareHeaderForMatch = args => CleanHeader(args.Header),
            MissingFieldFound = null,
            HeaderValidated = null,
            BadDataFound = null,
            TrimOptions = TrimOptions.Trim
        };

        await using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream, Encoding.UTF8, true);
        using var csv = new CsvReader(reader, configuration);

        if (!await csv.ReadAsync())
        {
            throw new ArgumentException("Employee import CSV must include a header row.", nameof(file));
        }

        csv.ReadHeader();
        var headers = csv.HeaderRecord?.Select(CleanHeader).ToList() ?? [];

        if (headers.Count == 0)
        {
            throw new ArgumentException("Employee import CSV must include a header row.", nameof(file));
        }

        var rows = new List<EmployeeImportSourceRowDto>();
        while (await csv.ReadAsync())
        {
            cancellationToken.ThrowIfCancellationRequested();

            var values = headers.ToDictionary(
                header => header,
                header => NormalizeOptional(csv.GetField(header)),
                StringComparer.Ordinal);

            rows.Add(new EmployeeImportSourceRowDto(rows.Count + 1, values));

            if (rows.Count > MaxRowCount)
            {
                throw new ArgumentException(
                    $"Employee import supports up to {MaxRowCount} rows per upload.",
                    nameof(file));
            }
        }

        return new ParsedCsvFile(headers, rows);
    }

    private static EmployeeImportPreviewRowDto CreatePreviewRow(EmployeeImportSourceRowDto row)
    {
        row.Values.TryGetValue("firstName", out var firstName);
        row.Values.TryGetValue("lastName", out var lastName);
        row.Values.TryGetValue("email", out var email);
        row.Values.TryGetValue("hireDate", out var hireDate);
        row.Values.TryGetValue("jobTitle", out var jobTitle);
        row.Values.TryGetValue("orgUnitCode", out var orgUnitCode);
        row.Values.TryGetValue("managerEmail", out var managerEmail);

        return new EmployeeImportPreviewRowDto(
            row.RowNumber,
            NormalizeOptional(firstName),
            NormalizeOptional(lastName),
            NormalizeEmail(email),
            NormalizeOptional(hireDate),
            NormalizeOptional(jobTitle),
            NormalizeOrgUnitCode(orgUnitCode),
            NormalizeEmail(managerEmail));
    }

    private static EmployeeImportSessionDto BuildSessionDto(
        EmployeeImportSession session,
        IReadOnlyList<string> headers,
        IReadOnlyList<EmployeeImportSourceRowDto> sourceRows,
        IReadOnlyList<EmployeeImportPreviewRowDto> previewRows)
    {
        var previewWindow = previewRows.Take(PreviewRowCount).ToList();
        return new EmployeeImportSessionDto(
            session.Id,
            session.Stage,
            session.Version,
            session.SourceFileName,
            session.SourceFileSizeBytes,
            sourceRows.Count,
            headers.ToList(),
            sourceRows.Take(SampleRowCount).ToList(),
            previewWindow,
            previewRows.Count > previewWindow.Count,
            session.ExpiresAt,
            BuildSchema());
    }

    private static T? Deserialize<T>(string json)
        => JsonSerializer.Deserialize<T>(json, JsonOptions);

    private static string CleanHeader(string? header)
        => (header ?? string.Empty).Trim().TrimStart('\uFEFF');

    private static string? NormalizeOptional(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private static string? NormalizeEmail(string? value)
        => NormalizeOptional(value)?.ToLowerInvariant();

    private static string? NormalizeOrgUnitCode(string? value)
        => NormalizeOptional(value)?.ToUpperInvariant();

    private sealed record ParsedCsvFile(
        IReadOnlyList<string> Headers,
        IReadOnlyList<EmployeeImportSourceRowDto> Rows);
}
using System.Globalization;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using CsvHelper;
using CsvHelper.Configuration;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
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
    Task<EmployeeImportSessionDto> ValidateAsync(Guid sessionId, CancellationToken cancellationToken);
    Task<EmployeeImportSessionDto> ValidateAsync(
        Guid sessionId,
        int previewPageNumber,
        int previewPageSize,
        string previewFilter,
        string? groupKey,
        CancellationToken cancellationToken);
    Task<EmployeeImportSessionDto> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken);
    Task<EmployeeImportSessionDto> GetSessionAsync(
        Guid sessionId,
        int previewPageNumber,
        int previewPageSize,
        string previewFilter,
        string? groupKey,
        CancellationToken cancellationToken);
    Task<EmployeeImportApplyResultDto> ApplyAsync(
        Guid sessionId,
        EmployeeImportActorDto actor,
        CancellationToken cancellationToken);
    Task<EmployeeImportHistoryPageDto> GetHistoryAsync(
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken);
    Task<EmployeeImportHistoryDetailDto> GetHistoryDetailAsync(
        Guid historyId,
        CancellationToken cancellationToken);
}

public sealed class EmployeeImportWorkflowService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext,
    IEmployeeHierarchyService hierarchyService,
    ITenantSettingsReadService? tenantSettingsReadService = null) : IEmployeeImportWorkflowService
{
    private readonly IEmployeeHierarchyService employeeHierarchyService = hierarchyService;
    private readonly ITenantSettingsReadService tenantSettingsReader =
        tenantSettingsReadService ?? new TenantSettingsReadService(dbContext);

    private const int MaxSourceFileNameLength = 260;
    private const int MaxRowCount = 5000;
    private const int SampleRowCount = 12;
    private const int DefaultPreviewPageSize = 25;
    private const int MaxPreviewPageSize = 100;
    private const int MaxHistoryPageSize = 50;
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(2);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly HashSet<string> OperationallyRequiredFields =
        ["firstName", "lastName", "email", "hireDate"];
    private static readonly IReadOnlyList<EmployeeImportCanonicalFieldDto> CanonicalFields =
    [
        new(
            "employeeNumber",
            "Employee number",
            false,
            "Optional stable workforce reference used across imports and downstream modules.",
            "E-10428"),
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
            "phone",
            "Phone",
            false,
            "Optional employee contact number shown on the Core profile.",
            "+44 7700 900123"),
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
            "workLocation",
            "Work location",
            false,
            "Optional office, site, or primary work location shown on the employee profile.",
            "London HQ"),
        new(
            "employmentType",
            "Employment type",
            false,
            "Optional employment classification such as Full-time or Contractor.",
            "Full-time"),
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
        return await BuildSchemaAsync(cancellationToken);
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

        return await BuildSessionDtoAsync(
            session,
            parsedFile.Headers,
            parsedFile.Rows,
            previewRows,
            cancellationToken: cancellationToken);
    }

    public async Task<EmployeeImportSessionDto> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken)
        => await GetSessionAsync(
            sessionId,
            1,
            DefaultPreviewPageSize,
            "all",
            null,
            cancellationToken);

    public async Task<EmployeeImportSessionDto> GetSessionAsync(
        Guid sessionId,
        int previewPageNumber,
        int previewPageSize,
        string previewFilter,
        string? groupKey,
        CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);

        var session = await dbContext.EmployeeImportSessions
            .FirstOrDefaultAsync(current => current.Id == sessionId, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(EmployeeImportSession), sessionId);

        await MarkExpiredIfNeededAsync(session, cancellationToken);

        var headers = Deserialize<List<string>>(session.SourceHeadersJson) ?? [];
        var sourceRows = Deserialize<List<EmployeeImportSourceRowDto>>(session.SourceRowsJson) ?? [];
        var previewRows = Deserialize<List<EmployeeImportPreviewRowDto>>(session.PreviewRowsJson) ?? [];

        return await BuildSessionDtoAsync(
            session,
            headers,
            sourceRows,
            previewRows,
            cancellationToken,
            previewPageNumber,
            previewPageSize,
            previewFilter,
            groupKey);
    }

    public async Task<EmployeeImportSessionDto> ValidateAsync(Guid sessionId, CancellationToken cancellationToken)
        => await ValidateAsync(
            sessionId,
            1,
            DefaultPreviewPageSize,
            "all",
            null,
            cancellationToken);

    public async Task<EmployeeImportSessionDto> ValidateAsync(
        Guid sessionId,
        int previewPageNumber,
        int previewPageSize,
        string previewFilter,
        string? groupKey,
        CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);

        var session = await dbContext.EmployeeImportSessions
            .FirstOrDefaultAsync(current => current.Id == sessionId, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(EmployeeImportSession), sessionId);

        await MarkExpiredIfNeededAsync(session, cancellationToken);

        if (session.Stage == EmployeeImportStage.Applied)
        {
            throw new ArgumentException("This employee import session has already been applied.", nameof(sessionId));
        }

        if (session.Stage == EmployeeImportStage.Expired)
        {
            throw new ArgumentException("Upload expired. Upload the file again to continue.", nameof(sessionId));
        }

        var sourceRows = Deserialize<List<EmployeeImportSourceRowDto>>(session.SourceRowsJson) ?? [];
        var settings = await tenantSettingsReader.GetCurrentAsync(cancellationToken);
        var validation = await ValidateRowsAsync(sourceRows, settings, cancellationToken);

        session.SetValidationResult(
            JsonSerializer.Serialize(validation.NormalizedRows, JsonOptions),
            JsonSerializer.Serialize(validation.Issues, JsonOptions));

        await dbContext.SaveChangesAsync(cancellationToken);

        var headers = Deserialize<List<string>>(session.SourceHeadersJson) ?? [];
        var previewRows = Deserialize<List<EmployeeImportPreviewRowDto>>(session.PreviewRowsJson) ?? [];

        return await BuildSessionDtoAsync(
            session,
            headers,
            sourceRows,
            previewRows,
            cancellationToken,
            previewPageNumber,
            previewPageSize,
            previewFilter,
            groupKey);
    }

    public async Task<EmployeeImportApplyResultDto> ApplyAsync(
        Guid sessionId,
        EmployeeImportActorDto actor,
        CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);

        var session = await dbContext.EmployeeImportSessions
            .FirstOrDefaultAsync(current => current.Id == sessionId, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(EmployeeImportSession), sessionId);

        await MarkExpiredIfNeededAsync(session, cancellationToken);

        if (session.Stage == EmployeeImportStage.Applied)
        {
            throw new ArgumentException("This employee import session has already been applied.", nameof(sessionId));
        }

        if (session.Stage == EmployeeImportStage.Expired)
        {
            throw new ArgumentException("Upload expired. Upload the file again to continue.", nameof(sessionId));
        }

        if (session.Stage != EmployeeImportStage.Validated)
        {
            throw new ArgumentException("Validate the import before applying it.", nameof(sessionId));
        }

        var validationIssues = ReadRequiredValidationIssues(session);
        if (validationIssues.Any(issue => issue.Severity.Equals("error", StringComparison.OrdinalIgnoreCase)))
        {
            throw new ArgumentException("The import contains validation errors. Fix them before applying.", nameof(sessionId));
        }

        var normalizedRows = ReadNormalizedRows(session);
        if (normalizedRows.Count == 0)
        {
            throw new ArgumentException("The import does not contain any valid employee rows to apply.", nameof(sessionId));
        }

        var settings = await tenantSettingsReader.GetCurrentAsync(cancellationToken);

        var sourceRows = ReadSourceRows(session);
        var importedEmails = normalizedRows
            .Select(row => row.Email)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var duplicateEmails = await dbContext.Employees
            .AsNoTracking()
            .Where(employee => importedEmails.Contains(employee.Email))
            .Select(employee => employee.Email)
            .OrderBy(email => email)
            .ToListAsync(cancellationToken);

        var importedEmployeeNumbers = normalizedRows
            .Where(row => !string.IsNullOrWhiteSpace(row.EmployeeNumber))
            .Select(row => row.EmployeeNumber!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var duplicateEmployeeNumbers = importedEmployeeNumbers.Count == 0
            ? []
            : await dbContext.Employees
                .AsNoTracking()
                .Where(employee => employee.EmployeeNumber != null && importedEmployeeNumbers.Contains(employee.EmployeeNumber))
                .Select(employee => employee.EmployeeNumber!)
                .OrderBy(employeeNumber => employeeNumber)
                .ToListAsync(cancellationToken);

        if (duplicateEmails.Count > 0)
        {
            throw new ArgumentException(
                "One or more employee emails already exist in this tenant. Validate the file again before applying.",
                nameof(sessionId));
        }

        if (duplicateEmployeeNumbers.Count > 0)
        {
            throw new ArgumentException(
                "One or more employee numbers already exist in this tenant. Validate the file again before applying.",
                nameof(sessionId));
        }

        var useTransaction = !string.Equals(
            dbContext.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.OrdinalIgnoreCase);
        await using var transaction = useTransaction
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        var employeesByEmail = new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase);

        foreach (var row in normalizedRows)
        {
            var employee = Employee.Create(
                tenantContext.TenantId,
                row.FirstName,
                row.LastName,
                row.Email,
                row.HireDate,
                null,
                row.JobTitle,
                row.EmployeeNumber,
                row.Phone,
                row.WorkLocation,
                row.EmploymentType);

            if (row.OrgUnitId.HasValue)
            {
                employee.AssignOrgUnit(row.OrgUnitId);
            }

            employeesByEmail.Add(row.Email, employee);
            dbContext.Employees.Add(employee);
        }

        var pendingEmployeesById = employeesByEmail.Values
            .ToDictionary(employee => employee.Id);

        foreach (var row in normalizedRows.Where(current => !string.IsNullOrWhiteSpace(current.ManagerEmail)))
        {
            var employee = employeesByEmail[row.Email];
            var managerId = row.ExistingManagerId;

            if (!managerId.HasValue)
            {
                if (!employeesByEmail.TryGetValue(row.ManagerEmail!, out var sameFileManager))
                {
                    throw new ArgumentException(
                        "The saved import session is no longer valid. Validate the file again before applying.",
                        nameof(sessionId));
                }

                managerId = sameFileManager.Id;
            }

            await employeeHierarchyService.EnsureManagerAssignmentIsValidAsync(
                employee.Id,
                managerId,
                cancellationToken,
                pendingEmployeesById);
            employee.AssignManager(managerId);
        }

        var appliedAt = DateTime.UtcNow;
        var history = EmployeeImportHistory.CreateApplied(
            tenantContext.TenantId,
            session.Id,
            session.SourceFileName,
            session.SourceFileSizeBytes,
            sourceRows.Count,
            normalizedRows.Count,
            normalizedRows.Count,
            0,
            appliedAt,
            actor.UserId,
            actor.FullName,
            actor.Role);

        var importFollowUpIssues = BuildImportFollowUpIssues(
            history.Id,
            employeesByEmail,
            normalizedRows,
            settings);

        dbContext.EmployeeImportHistories.Add(history);
        if (importFollowUpIssues.Count > 0)
        {
            dbContext.EmployeeImportFollowUpIssues.AddRange(importFollowUpIssues);
        }
        session.MarkApplied(appliedAt);

        await dbContext.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return new EmployeeImportApplyResultDto(
            session.Id,
            history.Id,
            session.SourceFileName,
            sourceRows.Count,
            normalizedRows.Count,
            normalizedRows.Count,
            0,
            appliedAt,
            session.Stage);
    }

    public async Task<EmployeeImportHistoryPageDto> GetHistoryAsync(
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);

        var currentPageSize = Math.Clamp(pageSize, 1, MaxHistoryPageSize);
        var query = dbContext.EmployeeImportHistories
            .AsNoTracking()
            .OrderByDescending(history => history.AppliedAt)
            .ThenByDescending(history => history.CreatedAt);

        var totalCount = await query.CountAsync(cancellationToken);
        var pageCount = Math.Max(1, (int)Math.Ceiling(totalCount / (double)currentPageSize));
        var currentPageNumber = Math.Min(Math.Max(pageNumber, 1), pageCount);

        var items = await query
            .Skip((currentPageNumber - 1) * currentPageSize)
            .Take(currentPageSize)
            .Select(history => BuildHistoryListItemDto(history))
            .ToListAsync(cancellationToken);

        return new EmployeeImportHistoryPageDto(
            items,
            currentPageNumber,
            currentPageSize,
            totalCount,
            pageCount);
    }

    public async Task<EmployeeImportHistoryDetailDto> GetHistoryDetailAsync(
        Guid historyId,
        CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);

        var history = await dbContext.EmployeeImportHistories
            .AsNoTracking()
            .FirstOrDefaultAsync(current => current.Id == historyId, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(EmployeeImportHistory), historyId);

        var unresolvedFollowUpIssues = await BuildUnresolvedFollowUpIssuesAsync(historyId, cancellationToken);

        return BuildHistoryDetailDto(history, unresolvedFollowUpIssues);
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

    private async Task MarkExpiredIfNeededAsync(EmployeeImportSession session, CancellationToken cancellationToken)
    {
        if (session.Stage == EmployeeImportStage.Expired
            || session.Stage == EmployeeImportStage.Applied
            || session.ExpiresAt > DateTime.UtcNow)
        {
            return;
        }

        session.MarkExpired();
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<EmployeeImportSchemaDto> BuildSchemaAsync(CancellationToken cancellationToken)
    {
        var settings = await tenantSettingsReader.GetCurrentAsync(cancellationToken);
        return BuildSchema(settings);
    }

    private static EmployeeImportSchemaDto BuildSchema(TenantSettingsDto settings) =>
        new(CanonicalFields
            .Select(field => field with
            {
                Required = ResolveImportFieldRequired(field.Key, settings, field.Required)
            })
            .ToList());

    private static bool ResolveImportFieldRequired(
        string fieldKey,
        TenantSettingsDto settings,
        bool fallbackRequired)
        => OperationallyRequiredFields.Contains(fieldKey)
            || (settings.EmployeeFieldConfig.TryGetValue(fieldKey, out var fieldConfig)
            ? fieldConfig.Required
            : fallbackRequired);

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
        var legacyHeaders = expectedHeaders
            .Where(header => !string.Equals(header, "employeeNumber", StringComparison.Ordinal)
                && !string.Equals(header, "phone", StringComparison.Ordinal)
                && !string.Equals(header, "workLocation", StringComparison.Ordinal)
                && !string.Equals(header, "employmentType", StringComparison.Ordinal))
            .ToArray();
        var legacyHeadersWithEmployeeNumber = expectedHeaders
            .Where(header => !string.Equals(header, "phone", StringComparison.Ordinal)
                && !string.Equals(header, "workLocation", StringComparison.Ordinal)
                && !string.Equals(header, "employmentType", StringComparison.Ordinal))
            .ToArray();

        if (HeadersMatch(actualHeaders, expectedHeaders)
            || HeadersMatch(actualHeaders, legacyHeaders)
            || HeadersMatch(actualHeaders, legacyHeadersWithEmployeeNumber))
        {
            return;
        }

        throw new ArgumentException(
            "Use the official employee import template. Column headers must match exactly in the expected order.");
    }

    private static bool HeadersMatch(IReadOnlyList<string> actualHeaders, IReadOnlyList<string> expectedHeaders)
    {
        if (actualHeaders.Count != expectedHeaders.Count)
        {
            return false;
        }

        for (var index = 0; index < expectedHeaders.Count; index++)
        {
            if (!string.Equals(CleanHeader(actualHeaders[index]), expectedHeaders[index], StringComparison.Ordinal))
            {
                return false;
            }
        }

        return true;
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
        row.Values.TryGetValue("employeeNumber", out var employeeNumber);
        row.Values.TryGetValue("firstName", out var firstName);
        row.Values.TryGetValue("lastName", out var lastName);
        row.Values.TryGetValue("email", out var email);
        row.Values.TryGetValue("phone", out var phone);
        row.Values.TryGetValue("hireDate", out var hireDate);
        row.Values.TryGetValue("jobTitle", out var jobTitle);
        row.Values.TryGetValue("workLocation", out var workLocation);
        row.Values.TryGetValue("employmentType", out var employmentType);
        row.Values.TryGetValue("orgUnitCode", out var orgUnitCode);
        row.Values.TryGetValue("managerEmail", out var managerEmail);

        return new EmployeeImportPreviewRowDto(
            row.RowNumber,
            NormalizeEmployeeNumber(employeeNumber),
            NormalizeOptional(firstName),
            NormalizeOptional(lastName),
            NormalizeEmail(email),
            NormalizeOptional(phone),
            NormalizeOptional(hireDate),
            NormalizeOptional(jobTitle),
            NormalizeOptional(workLocation),
            NormalizeOptional(employmentType),
            NormalizeOrgUnitCode(orgUnitCode),
            NormalizeEmail(managerEmail));
    }

    private async Task<ValidationResult> ValidateRowsAsync(
        IReadOnlyCollection<EmployeeImportSourceRowDto> sourceRows,
        TenantSettingsDto settings,
        CancellationToken cancellationToken)
    {
        var issues = new List<StoredValidationIssue>();
        var issueKeys = new HashSet<ValidationIssueKey>();
        var rowErrorNumbers = new HashSet<int>();
        var issueCodesByRow = new Dictionary<int, HashSet<string>>();
        var candidates = new List<CandidateRow>(sourceRows.Count);
        var emailOccurrences = new Dictionary<string, List<int>>(StringComparer.OrdinalIgnoreCase);
        var orgUnitCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var referencedManagerEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var sourceRow in sourceRows)
        {
            var employeeNumber = NormalizeEmployeeNumber(ReadValue(sourceRow, "employeeNumber"));
            var firstName = ReadValue(sourceRow, "firstName");
            var lastName = ReadValue(sourceRow, "lastName");
            var email = NormalizeEmail(ReadValue(sourceRow, "email"));
            var phone = NormalizeOptional(ReadValue(sourceRow, "phone"));
            var hireDateText = ReadValue(sourceRow, "hireDate");
            var jobTitle = ReadValue(sourceRow, "jobTitle");
            var workLocation = NormalizeOptional(ReadValue(sourceRow, "workLocation"));
            var employmentType = NormalizeOptional(ReadValue(sourceRow, "employmentType"));
            var orgUnitCode = NormalizeOrgUnitCode(ReadValue(sourceRow, "orgUnitCode"));
            var managerEmail = NormalizeEmail(ReadValue(sourceRow, "managerEmail"));

            if (!string.IsNullOrWhiteSpace(employeeNumber) && employeeNumber.Length > 64)
            {
                AddIssue(
                    issues,
                    issueKeys,
                    sourceRow.RowNumber,
                    "employeeNumber",
                    "invalidEmployeeNumber",
                    "Employee number must be 64 characters or fewer.",
                    value: employeeNumber,
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
            }

            if (ResolveImportFieldRequired("firstName", settings, true)
                && string.IsNullOrWhiteSpace(firstName))
            {
                AddIssue(issues, issueKeys, sourceRow.RowNumber, "firstName", "missingFirstName", "First name is required.", rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
            }

            if (ResolveImportFieldRequired("lastName", settings, true)
                && string.IsNullOrWhiteSpace(lastName))
            {
                AddIssue(issues, issueKeys, sourceRow.RowNumber, "lastName", "missingLastName", "Last name is required.", rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
            }

            if (ResolveImportFieldRequired("email", settings, true)
                && string.IsNullOrWhiteSpace(email))
            {
                AddIssue(issues, issueKeys, sourceRow.RowNumber, "email", "missingEmail", "Email is required.", rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
            }
            else if (!string.IsNullOrWhiteSpace(email) && !IsValidEmail(email))
            {
                AddIssue(issues, issueKeys, sourceRow.RowNumber, "email", "invalidEmail", "Email must be a valid work email address.", value: email, rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
            }

            DateTime? hireDate = null;
            DateTime parsedHireDate = default;
            if (ResolveImportFieldRequired("hireDate", settings, true)
                && string.IsNullOrWhiteSpace(hireDateText))
            {
                AddIssue(issues, issueKeys, sourceRow.RowNumber, "hireDate", "missingHireDate", "Hire date is required.", rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
            }
            else if (!string.IsNullOrWhiteSpace(hireDateText) && !TryParseHireDate(hireDateText, out parsedHireDate))
            {
                AddIssue(issues, issueKeys, sourceRow.RowNumber, "hireDate", "invalidHireDate", "Hire date must use YYYY-MM-DD format.", value: hireDateText, rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
            }
            else if (!string.IsNullOrWhiteSpace(hireDateText))
            {
                hireDate = parsedHireDate;
            }

            if (ResolveImportFieldRequired("jobTitle", settings, false)
                && string.IsNullOrWhiteSpace(jobTitle))
            {
                AddIssue(
                    issues,
                    issueKeys,
                    sourceRow.RowNumber,
                    "jobTitle",
                    "missingJobTitle",
                    "Job title is required.",
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
            }

            if (ResolveImportFieldRequired("phone", settings, false)
                && string.IsNullOrWhiteSpace(phone))
            {
                AddIssue(
                    issues,
                    issueKeys,
                    sourceRow.RowNumber,
                    "phone",
                    "missingPhone",
                    "Phone is required.",
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
            }

            if (ResolveImportFieldRequired("workLocation", settings, false)
                && string.IsNullOrWhiteSpace(workLocation))
            {
                AddIssue(
                    issues,
                    issueKeys,
                    sourceRow.RowNumber,
                    "workLocation",
                    "missingWorkLocation",
                    "Work location is required.",
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
            }

            if (ResolveImportFieldRequired("employmentType", settings, false)
                && string.IsNullOrWhiteSpace(employmentType))
            {
                AddIssue(
                    issues,
                    issueKeys,
                    sourceRow.RowNumber,
                    "employmentType",
                    "missingEmploymentType",
                    "Employment type is required.",
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
            }

            if (!string.IsNullOrWhiteSpace(managerEmail) && !IsValidEmail(managerEmail))
            {
                AddIssue(issues, issueKeys, sourceRow.RowNumber, "managerEmail", "invalidManagerEmail", "Manager email must be a valid email address.", value: managerEmail, rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
            }

            if (!string.IsNullOrWhiteSpace(email)
                && !string.IsNullOrWhiteSpace(managerEmail)
                && email.Equals(managerEmail, StringComparison.OrdinalIgnoreCase))
            {
                AddIssue(issues, issueKeys, sourceRow.RowNumber, "managerEmail", "selfManager", "An employee cannot be their own manager.", value: email, rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
            }

            if (!string.IsNullOrWhiteSpace(email))
            {
                if (!emailOccurrences.TryGetValue(email, out var rowNumbers))
                {
                    rowNumbers = [];
                    emailOccurrences[email] = rowNumbers;
                }

                rowNumbers.Add(sourceRow.RowNumber);
            }

            if (!string.IsNullOrWhiteSpace(orgUnitCode))
            {
                orgUnitCodes.Add(orgUnitCode);
            }

            if (!string.IsNullOrWhiteSpace(managerEmail))
            {
                referencedManagerEmails.Add(managerEmail);
            }

            candidates.Add(new CandidateRow(
                sourceRow.RowNumber,
                employeeNumber,
                firstName,
                lastName,
                email,
                phone,
                hireDateText,
                hireDate,
                jobTitle,
                workLocation,
                employmentType,
                orgUnitCode,
                managerEmail));
        }

        foreach (var occurrence in emailOccurrences.Where(entry => entry.Value.Count > 1))
        {
            foreach (var rowNumber in occurrence.Value)
            {
                AddIssue(
                    issues,
                    issueKeys,
                    rowNumber,
                    "email",
                    "duplicateEmailInFile",
                    $"Email '{occurrence.Key}' is duplicated in the uploaded file.",
                    value: occurrence.Key,
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
            }
        }

        var employeeNumberOccurrences = candidates
            .Where(candidate => !string.IsNullOrWhiteSpace(candidate.EmployeeNumber))
            .GroupBy(candidate => candidate.EmployeeNumber!, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .ToList();

        foreach (var occurrence in employeeNumberOccurrences)
        {
            foreach (var candidate in occurrence)
            {
                AddIssue(
                    issues,
                    issueKeys,
                    candidate.RowNumber,
                    "employeeNumber",
                    "duplicateEmployeeNumberInFile",
                    $"Employee number '{occurrence.Key}' is duplicated in the uploaded file.",
                    value: occurrence.Key,
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
            }
        }

        var existingEmployeesByEmail = await dbContext.Employees
            .AsNoTracking()
            .Where(employee => emailOccurrences.Keys.Contains(employee.Email) || referencedManagerEmails.Contains(employee.Email))
            .Select(employee => new ExistingEmployeeReference(employee.Email, employee.Id, employee.Status == EmployeeStatus.Active))
            .ToListAsync(cancellationToken);

        var existingEmployeesByEmailLookup = existingEmployeesByEmail
            .GroupBy(employee => employee.Email, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var employeeNumbers = candidates
            .Where(candidate => !string.IsNullOrWhiteSpace(candidate.EmployeeNumber))
            .Select(candidate => candidate.EmployeeNumber!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var existingEmployeeNumbers = employeeNumbers.Count == 0
            ? []
            : await dbContext.Employees
                .AsNoTracking()
                .Where(employee => employee.EmployeeNumber != null && employeeNumbers.Contains(employee.EmployeeNumber))
                .Select(employee => employee.EmployeeNumber!)
                .Distinct()
                .ToListAsync(cancellationToken);

        var existingEmployeeNumberLookup = existingEmployeeNumbers
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in candidates)
        {
            if (!string.IsNullOrWhiteSpace(candidate.Email)
                && existingEmployeesByEmailLookup.ContainsKey(candidate.Email))
            {
                AddIssue(
                    issues,
                    issueKeys,
                    candidate.RowNumber,
                    "email",
                    "duplicateEmailInTenant",
                    $"Email '{candidate.Email}' already exists in this tenant.",
                    value: candidate.Email,
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
            }

            if (!string.IsNullOrWhiteSpace(candidate.EmployeeNumber)
                && existingEmployeeNumberLookup.Contains(candidate.EmployeeNumber))
            {
                AddIssue(
                    issues,
                    issueKeys,
                    candidate.RowNumber,
                    "employeeNumber",
                    "duplicateEmployeeNumberInTenant",
                    $"Employee number '{candidate.EmployeeNumber}' already exists in this tenant.",
                    value: candidate.EmployeeNumber,
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
            }
        }

        var orgUnitsByCode = await dbContext.OrgUnits
            .AsNoTracking()
            .Where(orgUnit => orgUnitCodes.Contains(orgUnit.Code))
            .Select(orgUnit => new { orgUnit.Code, orgUnit.Id, orgUnit.IsActive })
            .ToListAsync(cancellationToken);
        var orgUnitLookup = orgUnitsByCode.ToDictionary(orgUnit => orgUnit.Code, StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in candidates)
        {
            if (string.IsNullOrWhiteSpace(candidate.OrgUnitCode))
            {
                continue;
            }

            if (!orgUnitLookup.TryGetValue(candidate.OrgUnitCode, out var orgUnit))
            {
                AddIssue(
                    issues,
                    issueKeys,
                    candidate.RowNumber,
                    "orgUnitCode",
                    "orgUnitNotFound",
                    $"Org unit code '{candidate.OrgUnitCode}' was not found in the current tenant.",
                    value: candidate.OrgUnitCode,
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
                continue;
            }

            if (!orgUnit.IsActive)
            {
                AddIssue(
                    issues,
                    issueKeys,
                    candidate.RowNumber,
                    "orgUnitCode",
                    "orgUnitInactive",
                    $"Org unit code '{candidate.OrgUnitCode}' is inactive.",
                    value: candidate.OrgUnitCode,
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
                continue;
            }

            candidate.ResolvedOrgUnitId = orgUnit.Id;
        }

        var uniqueRowsByEmail = candidates
            .Where(candidate => !string.IsNullOrWhiteSpace(candidate.Email))
            .GroupBy(candidate => candidate.Email!, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() == 1)
            .ToDictionary(group => group.Key, group => group.Single(), StringComparer.OrdinalIgnoreCase);
        var validationState = new Dictionary<string, ManagerValidationState>(StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in candidates)
        {
            ValidateManagerReference(
                candidate,
                uniqueRowsByEmail,
                emailOccurrences,
                existingEmployeesByEmailLookup,
                issues,
                issueKeys,
                rowErrorNumbers,
                issueCodesByRow,
                validationState,
                []);
        }

        var normalizedRows = candidates
            .Where(candidate => !HasErrors(rowErrorNumbers, candidate.RowNumber)
                && (!ResolveImportFieldRequired("firstName", settings, true)
                    || !string.IsNullOrWhiteSpace(candidate.FirstName))
                && (!ResolveImportFieldRequired("lastName", settings, true)
                    || !string.IsNullOrWhiteSpace(candidate.LastName))
                && (!ResolveImportFieldRequired("email", settings, true)
                    || !string.IsNullOrWhiteSpace(candidate.Email))
                && (!ResolveImportFieldRequired("phone", settings, false)
                    || !string.IsNullOrWhiteSpace(candidate.Phone))
                && (!ResolveImportFieldRequired("hireDate", settings, true)
                    || candidate.HireDate.HasValue)
                && (!ResolveImportFieldRequired("jobTitle", settings, false)
                    || !string.IsNullOrWhiteSpace(candidate.JobTitle))
                && (!ResolveImportFieldRequired("workLocation", settings, false)
                    || !string.IsNullOrWhiteSpace(candidate.WorkLocation))
                && (!ResolveImportFieldRequired("employmentType", settings, false)
                    || !string.IsNullOrWhiteSpace(candidate.EmploymentType)))
            .Select(candidate => new StoredNormalizedRow(
                candidate.RowNumber,
                candidate.EmployeeNumber,
                candidate.FirstName!,
                candidate.LastName!,
                candidate.Email!,
                candidate.Phone,
                candidate.HireDate!.Value,
                candidate.JobTitle,
                candidate.WorkLocation,
                candidate.EmploymentType,
                candidate.OrgUnitCode,
                candidate.ResolvedOrgUnitId,
                candidate.ManagerEmail,
                candidate.ResolvedExistingManagerId))
            .OrderBy(row => row.RowNumber)
            .ToList();

        return new ValidationResult(
            normalizedRows,
            issues
                .OrderBy(issue => issue.RowNumber)
                .ThenBy(issue => issue.Field)
                .ThenBy(issue => issue.Code)
                .ToList());
    }

    private static bool ValidateManagerReference(
        CandidateRow candidate,
        IReadOnlyDictionary<string, CandidateRow> uniqueRowsByEmail,
        IReadOnlyDictionary<string, List<int>> emailOccurrences,
        IReadOnlyDictionary<string, ExistingEmployeeReference> existingEmployeesByEmail,
        List<StoredValidationIssue> issues,
        HashSet<ValidationIssueKey> issueKeys,
        ISet<int> rowErrorNumbers,
        IReadOnlyDictionary<int, HashSet<string>> issueCodesByRow,
        Dictionary<string, ManagerValidationState> validationState,
        List<string> chain)
    {
        if (string.IsNullOrWhiteSpace(candidate.ManagerEmail))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(candidate.Email) || HasErrors(rowErrorNumbers, candidate.RowNumber))
        {
            return false;
        }

        if (existingEmployeesByEmail.TryGetValue(candidate.ManagerEmail, out var existingManager))
        {
            if (!existingManager.IsActive)
            {
                AddIssue(
                    issues,
                    issueKeys,
                    candidate.RowNumber,
                    "managerEmail",
                    "managerInactive",
                    $"Manager email '{candidate.ManagerEmail}' belongs to an inactive employee in this tenant.",
                    value: candidate.ManagerEmail,
                    rowErrorNumbers: rowErrorNumbers,
                    issueCodesByRow: issueCodesByRow);
                return false;
            }

            candidate.ResolvedExistingManagerId = existingManager.Id;
            return true;
        }

        if (emailOccurrences.TryGetValue(candidate.ManagerEmail, out var duplicateRows) && duplicateRows.Count > 1)
        {
            AddIssue(
                issues,
                issueKeys,
                candidate.RowNumber,
                "managerEmail",
                "ambiguousManagerEmail",
                $"Manager email '{candidate.ManagerEmail}' is duplicated in the uploaded file and cannot be resolved.",
                value: candidate.ManagerEmail,
                rowErrorNumbers: rowErrorNumbers,
                issueCodesByRow: issueCodesByRow);
            return false;
        }

        if (!uniqueRowsByEmail.TryGetValue(candidate.ManagerEmail, out var managerRow))
        {
            AddIssue(
                issues,
                issueKeys,
                candidate.RowNumber,
                "managerEmail",
                "managerNotFound",
                $"Manager email '{candidate.ManagerEmail}' was not found in this tenant or the uploaded file.",
                value: candidate.ManagerEmail,
                rowErrorNumbers: rowErrorNumbers,
                issueCodesByRow: issueCodesByRow);
            return false;
        }

        var employeeEmail = candidate.Email!;
        if (validationState.TryGetValue(employeeEmail, out var state))
        {
            if (state == ManagerValidationState.Visiting)
            {
                AddManagerCycleIssues(chain, employeeEmail, uniqueRowsByEmail, issues, issueKeys, rowErrorNumbers, issueCodesByRow);
                validationState[employeeEmail] = ManagerValidationState.Invalid;
                return false;
            }

            return state == ManagerValidationState.Valid;
        }

        if (chain.Contains(employeeEmail, StringComparer.OrdinalIgnoreCase))
        {
            AddManagerCycleIssues(chain, employeeEmail, uniqueRowsByEmail, issues, issueKeys, rowErrorNumbers, issueCodesByRow);
            validationState[employeeEmail] = ManagerValidationState.Invalid;
            return false;
        }

        validationState[employeeEmail] = ManagerValidationState.Visiting;
        chain.Add(employeeEmail);

        var isValid = !HasErrors(rowErrorNumbers, managerRow.RowNumber)
            && ValidateManagerReference(
                managerRow,
                uniqueRowsByEmail,
                emailOccurrences,
                existingEmployeesByEmail,
                issues,
                issueKeys,
                rowErrorNumbers,
                issueCodesByRow,
                validationState,
                chain);

        chain.RemoveAt(chain.Count - 1);

        if (!isValid && !HasIssue(issueCodesByRow, candidate.RowNumber, "managerCycle"))
        {
            AddIssue(
                issues,
                issueKeys,
                candidate.RowNumber,
                "managerEmail",
                "managerInvalidInBatch",
                $"Manager email '{candidate.ManagerEmail}' must resolve to a valid employee in this tenant or this upload.",
            value: candidate.ManagerEmail,
            rowErrorNumbers: rowErrorNumbers,
            issueCodesByRow: issueCodesByRow);
        }

        validationState[employeeEmail] = isValid ? ManagerValidationState.Valid : ManagerValidationState.Invalid;
        return isValid;
    }

    private static void AddManagerCycleIssues(
        IReadOnlyList<string> chain,
        string repeatedEmail,
        IReadOnlyDictionary<string, CandidateRow> uniqueRowsByEmail,
        List<StoredValidationIssue> issues,
        HashSet<ValidationIssueKey> issueKeys,
        ISet<int> rowErrorNumbers,
        IReadOnlyDictionary<int, HashSet<string>> issueCodesByRow)
    {
        var cycleStart = chain
            .Select((email, index) => new { email, index })
            .First(entry => entry.email.Equals(repeatedEmail, StringComparison.OrdinalIgnoreCase))
            .index;
        var cycleRowNumbers = chain
            .Skip(cycleStart)
            .Select(email => uniqueRowsByEmail.TryGetValue(email, out var row) ? row.RowNumber : 0)
            .Where(rowNumber => rowNumber > 0)
            .OrderBy(rowNumber => rowNumber)
            .ToList();
        var groupKey = $"managerCycle:{string.Join("-", cycleRowNumbers)}";

        for (var index = cycleStart; index < chain.Count; index++)
        {
            var cycleEmail = chain[index];
            if (!uniqueRowsByEmail.TryGetValue(cycleEmail, out var cycleRow))
            {
                continue;
            }

            AddIssue(
                issues,
                issueKeys,
                cycleRow.RowNumber,
                "managerEmail",
                "managerCycle",
                "Manager references in the uploaded file contain a cycle.",
                groupKey: groupKey,
                rowErrorNumbers: rowErrorNumbers,
                issueCodesByRow: issueCodesByRow);
        }
    }

    private async Task<EmployeeImportSessionDto> BuildSessionDtoAsync(
        EmployeeImportSession session,
        IReadOnlyList<string> headers,
        IReadOnlyList<EmployeeImportSourceRowDto> sourceRows,
        IReadOnlyList<EmployeeImportPreviewRowDto> previewRows,
        CancellationToken cancellationToken,
        int previewPageNumber = 1,
        int previewPageSize = DefaultPreviewPageSize,
        string previewFilter = "all",
        string? groupKey = null)
    {
        var schema = await BuildSchemaAsync(cancellationToken);

        return BuildSessionDto(
            session,
            headers,
            sourceRows,
            previewRows,
            schema,
            previewPageNumber,
            previewPageSize,
            previewFilter,
            groupKey);
    }

    private static EmployeeImportSessionDto BuildSessionDto(
        EmployeeImportSession session,
        IReadOnlyList<string> headers,
        IReadOnlyList<EmployeeImportSourceRowDto> sourceRows,
        IReadOnlyList<EmployeeImportPreviewRowDto> previewRows,
        EmployeeImportSchemaDto schema,
        int previewPageNumber = 1,
        int previewPageSize = DefaultPreviewPageSize,
        string previewFilter = "all",
        string? groupKey = null)
    {
        var validationIssues = ReadValidationIssues(session)
            .Select(issue => new EmployeeImportValidationIssueDto(
                issue.RowNumber,
                issue.Field,
                issue.Severity,
                issue.Code,
                issue.Message,
                ResolveIssueCategory(issue),
                ResolveIssueGroupKey(issue),
                issue.Value,
                ResolveIssueFixHint(issue)))
            .ToList();
        var validationSummary = BuildValidationSummary(
            sourceRows.Count,
            validationIssues,
            session.Stage is EmployeeImportStage.Validated or EmployeeImportStage.Applied);
        var filteredPreviewRows = FilterPreviewRows(
            previewRows,
            validationIssues,
            previewFilter,
            groupKey);
        var normalizedPreviewPageSize = Math.Clamp(
            previewPageSize,
            1,
            MaxPreviewPageSize);
        var previewPageCount = Math.Max(
            1,
            (int)Math.Ceiling(filteredPreviewRows.Count / (double)normalizedPreviewPageSize));
        var currentPreviewPage = Math.Min(Math.Max(previewPageNumber, 1), previewPageCount);
        var previewWindow = filteredPreviewRows
            .Skip((currentPreviewPage - 1) * normalizedPreviewPageSize)
            .Take(normalizedPreviewPageSize)
            .ToList();
        var canValidate =
            session.Stage != EmployeeImportStage.Expired &&
            session.Stage != EmployeeImportStage.Applied;
        var canApply =
            session.Stage == EmployeeImportStage.Validated &&
            validationSummary.ErrorCount == 0;

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
            currentPreviewPage,
            normalizedPreviewPageSize,
            previewPageCount,
            filteredPreviewRows.Count,
            currentPreviewPage < previewPageCount,
            validationSummary,
            validationIssues,
            session.AppliedAt,
            session.ExpiresAt,
            schema,
            canValidate,
            canApply);
    }

    private static List<EmployeeImportPreviewRowDto> FilterPreviewRows(
        IReadOnlyList<EmployeeImportPreviewRowDto> previewRows,
        IReadOnlyList<EmployeeImportValidationIssueDto> validationIssues,
        string previewFilter,
        string? groupKey)
    {
        IEnumerable<EmployeeImportPreviewRowDto> filteredRows = previewRows;

        if (string.Equals(previewFilter, "affected", StringComparison.OrdinalIgnoreCase))
        {
            var affectedRowNumbers = validationIssues
                .Select(issue => issue.RowNumber)
                .ToHashSet();

            filteredRows = filteredRows.Where(row => affectedRowNumbers.Contains(row.RowNumber));
        }

        if (!string.IsNullOrWhiteSpace(groupKey))
        {
            var groupRowNumbers = validationIssues
                .Where(issue => string.Equals(issue.GroupKey, groupKey, StringComparison.Ordinal))
                .Select(issue => issue.RowNumber)
                .ToHashSet();

            filteredRows = filteredRows.Where(row => groupRowNumbers.Contains(row.RowNumber));
        }

        return filteredRows.ToList();
    }

    private static EmployeeImportValidationSummaryDto BuildValidationSummary(
        int totalRows,
        IReadOnlyCollection<EmployeeImportValidationIssueDto> validationIssues,
        bool isValidated)
    {
        if (!isValidated)
        {
            return new EmployeeImportValidationSummaryDto(totalRows, 0, 0, 0);
        }

        var errorRows = validationIssues
            .Where(issue => issue.Severity.Equals("error", StringComparison.OrdinalIgnoreCase))
            .Select(issue => issue.RowNumber)
            .Distinct()
            .Count();
        var errorCount = validationIssues.Count(issue => issue.Severity.Equals("error", StringComparison.OrdinalIgnoreCase));
        var warningCount = validationIssues.Count(issue => issue.Severity.Equals("warning", StringComparison.OrdinalIgnoreCase));

        return new EmployeeImportValidationSummaryDto(
            totalRows,
            Math.Max(totalRows - errorRows, 0),
            errorCount,
            warningCount);
    }

    private static T? Deserialize<T>(string json)
        => JsonSerializer.Deserialize<T>(json, JsonOptions);

    private static List<EmployeeImportSourceRowDto> ReadSourceRows(EmployeeImportSession session)
        => ReadRequiredPayload<List<EmployeeImportSourceRowDto>>(
            session.SourceRowsJson,
            "The saved import session is no longer valid. Upload the file again.");

    private static List<StoredNormalizedRow> ReadNormalizedRows(EmployeeImportSession session)
        => ReadRequiredPayload<List<StoredNormalizedRow>>(
            session.NormalizedRowsJson,
            "The saved import session is no longer valid. Validate the file again before applying.");

    private static List<StoredValidationIssue> ReadValidationIssues(EmployeeImportSession session)
        => string.IsNullOrWhiteSpace(session.ValidationIssuesJson)
            ? []
            : Deserialize<List<StoredValidationIssue>>(session.ValidationIssuesJson) ?? [];

    private static List<StoredValidationIssue> ReadRequiredValidationIssues(EmployeeImportSession session)
        => ReadRequiredPayload<List<StoredValidationIssue>>(
            session.ValidationIssuesJson,
            "The saved import session is no longer valid. Validate the file again before applying.");

    private static T ReadRequiredPayload<T>(string? json, string invalidMessage)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            throw new ArgumentException(invalidMessage);
        }

        try
        {
            return JsonSerializer.Deserialize<T>(json, JsonOptions)
                ?? throw new ArgumentException(invalidMessage);
        }
        catch (JsonException ex)
        {
            throw new ArgumentException(invalidMessage, ex);
        }
    }

    private static EmployeeImportHistoryListItemDto BuildHistoryListItemDto(EmployeeImportHistory history)
        => new(
            history.Id,
            history.SessionId,
            history.SourceFileName,
            history.SourceFileSizeBytes,
            history.SourceRowCount,
            history.ValidRowCount,
            history.CreatedCount,
            history.SkippedCount,
            history.Status,
            history.AppliedAt,
            history.ActorUserId,
            history.ActorFullName,
            history.ActorRole);

    private static EmployeeImportHistoryDetailDto BuildHistoryDetailDto(
        EmployeeImportHistory history,
        IReadOnlyList<EmployeeImportFollowUpIssueDto> unresolvedFollowUpIssues)
        => new(
            history.Id,
            history.SessionId,
            history.Version,
            history.SourceFileName,
            history.SourceFileSizeBytes,
            history.SourceRowCount,
            history.ValidRowCount,
            history.CreatedCount,
            history.SkippedCount,
            history.Status,
            history.AppliedAt,
            history.ActorUserId,
            history.ActorFullName,
            history.ActorRole,
            history.FailureReason)
        {
            UnresolvedFollowUpIssues = unresolvedFollowUpIssues
        };

    private List<EmployeeImportFollowUpIssue> BuildImportFollowUpIssues(
        Guid historyId,
        IReadOnlyDictionary<string, Employee> employeesByEmail,
        IReadOnlyCollection<StoredNormalizedRow> normalizedRows,
        TenantSettingsDto settings)
    {
        var normalizedRowsByEmail = normalizedRows.ToDictionary(row => row.Email, StringComparer.OrdinalIgnoreCase);
        var directReportCounts = employeesByEmail.Values
            .Where(employee => employee.ManagerId.HasValue)
            .GroupBy(employee => employee.ManagerId!.Value)
            .ToDictionary(group => group.Key, group => group.Count());

        var followUpIssues = new List<EmployeeImportFollowUpIssue>();

        foreach (var (email, employee) in employeesByEmail)
        {
            var row = normalizedRowsByEmail[email];
            var directReportCount = directReportCounts.GetValueOrDefault(employee.Id);
            var hierarchyStatus = EmployeeReadModelPolicy.ResolveHierarchyStatus(employee, directReportCount);
            var readiness = EmployeeReadinessPolicy.BuildSummary(employee, settings, hierarchyStatus, directReportCount);

            foreach (var issue in readiness.EmployeeStateIssues)
            {
                followUpIssues.Add(EmployeeImportFollowUpIssue.Create(
                    tenantContext.TenantId,
                    historyId,
                    employee.Id,
                    row.RowNumber,
                    issue.Code,
                    issue.FieldKey));
            }
        }

        return followUpIssues;
    }

    private async Task<IReadOnlyList<EmployeeImportFollowUpIssueDto>> BuildUnresolvedFollowUpIssuesAsync(
        Guid historyId,
        CancellationToken cancellationToken)
    {
        var storedIssues = await dbContext.EmployeeImportFollowUpIssues
            .AsNoTracking()
            .Where(issue => issue.EmployeeImportHistoryId == historyId)
            .OrderBy(issue => issue.SourceRowNumber)
            .ThenBy(issue => issue.IssueCode)
            .ToListAsync(cancellationToken);

        if (storedIssues.Count == 0)
        {
            return Array.Empty<EmployeeImportFollowUpIssueDto>();
        }

        var employeeIds = storedIssues
            .Select(issue => issue.EmployeeId)
            .Distinct()
            .ToList();

        var employees = await dbContext.Employees
            .AsNoTracking()
            .Include(employee => employee.Manager)
            .Include(employee => employee.OrgUnit)
            .Where(employee => employeeIds.Contains(employee.Id))
            .ToListAsync(cancellationToken);

        if (employees.Count == 0)
        {
            return Array.Empty<EmployeeImportFollowUpIssueDto>();
        }

        var settings = await tenantSettingsReader.GetCurrentAsync(cancellationToken);
        var directReportCounts = await dbContext.Employees
            .AsNoTracking()
            .Where(employee => employee.ManagerId.HasValue
                && employee.Status == EmployeeStatus.Active
                && employeeIds.Contains(employee.ManagerId.Value))
            .GroupBy(employee => employee.ManagerId!.Value)
            .Select(group => new { ManagerId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.ManagerId, group => group.Count, cancellationToken);

        var readinessByEmployeeId = employees.ToDictionary(
            employee => employee.Id,
            employee =>
            {
                var directReportCount = directReportCounts.GetValueOrDefault(employee.Id);
                var hierarchyStatus = EmployeeReadModelPolicy.ResolveHierarchyStatus(employee, directReportCount);
                return EmployeeReadinessPolicy.BuildSummary(employee, settings, hierarchyStatus, directReportCount);
            });

        var employeesById = employees.ToDictionary(employee => employee.Id);
        var unresolvedIssues = new List<EmployeeImportFollowUpIssueDto>();

        foreach (var storedIssue in storedIssues)
        {
            if (!employeesById.TryGetValue(storedIssue.EmployeeId, out var employee)
                || !readinessByEmployeeId.TryGetValue(storedIssue.EmployeeId, out var readiness))
            {
                continue;
            }

            var currentIssue = readiness.EmployeeStateIssues.FirstOrDefault(issue =>
                issue.Code == storedIssue.IssueCode
                && string.Equals(issue.FieldKey, storedIssue.FieldKey, StringComparison.Ordinal));

            if (currentIssue is null)
            {
                continue;
            }

            unresolvedIssues.Add(new EmployeeImportFollowUpIssueDto(
                storedIssue.Id,
                storedIssue.SourceRowNumber,
                employee.Id,
                employee.FullName,
                employee.Email,
                currentIssue.Code,
                currentIssue.Label,
                currentIssue.FieldKey,
                currentIssue.FixTarget));
        }

        return unresolvedIssues;
    }

    private static string? ReadValue(EmployeeImportSourceRowDto row, string key)
    {
        row.Values.TryGetValue(key, out var value);
        return NormalizeOptional(value);
    }

    private static bool HasErrors(ISet<int> rowErrorNumbers, int rowNumber)
        => rowErrorNumbers.Contains(rowNumber);

    private static bool HasIssue(
        IReadOnlyDictionary<int, HashSet<string>> issueCodesByRow,
        int rowNumber,
        string code)
        => issueCodesByRow.TryGetValue(rowNumber, out var issueCodes)
            && issueCodes.Contains(code);

    private static void AddIssue(
        ICollection<StoredValidationIssue> issues,
        ISet<ValidationIssueKey> issueKeys,
        int rowNumber,
        string? field,
        string code,
        string message,
        string? value = null,
        string? groupKey = null,
        string? category = null,
        string? fixHint = null,
        ISet<int>? rowErrorNumbers = null,
        IReadOnlyDictionary<int, HashSet<string>>? issueCodesByRow = null)
    {
        var issueKey = new ValidationIssueKey(rowNumber, field, code);
        if (!issueKeys.Add(issueKey))
        {
            return;
        }

        rowErrorNumbers?.Add(rowNumber);

        if (issueCodesByRow is Dictionary<int, HashSet<string>> mutableIssueCodesByRow)
        {
            if (!mutableIssueCodesByRow.TryGetValue(rowNumber, out var issueCodes))
            {
                issueCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                mutableIssueCodesByRow[rowNumber] = issueCodes;
            }

            issueCodes.Add(code);
        }

        issues.Add(new StoredValidationIssue(
            rowNumber,
            field,
            "error",
            code,
            message,
            category ?? GetIssueCategory(code),
            groupKey ?? BuildDefaultGroupKey(code, rowNumber, value),
            value,
            fixHint ?? GetIssueFixHint(code)));
    }

    private static string ResolveIssueCategory(StoredValidationIssue issue)
        => string.IsNullOrWhiteSpace(issue.Category)
            ? GetIssueCategory(issue.Code)
            : issue.Category;

    private static string ResolveIssueGroupKey(StoredValidationIssue issue)
        => string.IsNullOrWhiteSpace(issue.GroupKey)
            ? BuildDefaultGroupKey(issue.Code, issue.RowNumber, issue.Value)
            : issue.GroupKey;

    private static string ResolveIssueFixHint(StoredValidationIssue issue)
        => string.IsNullOrWhiteSpace(issue.FixHint)
            ? GetIssueFixHint(issue.Code)
            : issue.FixHint;

    private static string BuildDefaultGroupKey(string code, int rowNumber, string? value)
        => code switch
        {
            _ when IsMissingRequiredFieldCode(code)
                => $"missingRequiredData:row:{rowNumber}",
            "duplicateEmailInFile" or "duplicateEmailInTenant" or "duplicateEmployeeNumberInFile" or "duplicateEmployeeNumberInTenant" or "orgUnitNotFound" or "orgUnitInactive"
                or "ambiguousManagerEmail" or "managerNotFound" or "managerInvalidInBatch" or "managerInactive"
                => string.IsNullOrWhiteSpace(value)
                    ? $"{code}:row:{rowNumber}"
                    : $"{code}:{value}",
            _ => $"{code}:row:{rowNumber}"
        };

    private static string GetIssueCategory(string code)
        => code switch
        {
            _ when IsMissingRequiredFieldCode(code)
                => "missingRequiredData",
            "invalidEmail" or "invalidHireDate" or "invalidManagerEmail" or "invalidEmployeeNumber"
                => "invalidFormat",
            "duplicateEmailInFile" or "duplicateEmailInTenant" or "duplicateEmployeeNumberInFile" or "duplicateEmployeeNumberInTenant"
                => "duplicateIdentity",
            "orgUnitNotFound" or "orgUnitInactive"
                => "invalidStructureReference",
            "selfManager" or "managerCycle"
                => "invalidRelationship",
            "ambiguousManagerEmail" or "managerNotFound" or "managerInvalidInBatch" or "managerInactive"
                => "invalidReportingReference",
            _ => "invalidReportingReference"
        };

    private static string GetIssueFixHint(string code)
        => code switch
        {
            "missingFirstName" => "Add a first name for this row.",
            "missingLastName" => "Add a last name for this row.",
            "missingEmail" => "Add a unique work email address for this row.",
            "invalidEmail" => "Enter a valid work email address for this row.",
            "invalidEmployeeNumber" => "Keep the employee number to 64 characters or fewer, using one stable value per employee.",
            "missingHireDate" => "Add a hire date in YYYY-MM-DD format for this row.",
            "missingJobTitle" => "Add a job title for this row.",
            "missingPhone" => "Add a phone number for this row.",
            "missingWorkLocation" => "Add a work location for this row.",
            "missingEmploymentType" => "Add an employment type for this row.",
            "invalidHireDate" => "Use YYYY-MM-DD format for the hire date in this row.",
            "invalidManagerEmail" => "Enter a valid manager email address or leave it blank.",
            "duplicateEmailInFile" => "Keep only one employee per unique email in this batch, or correct the mistaken row.",
            "duplicateEmailInTenant" => "Use a different email for this new employee or remove the row from the import.",
            "duplicateEmployeeNumberInFile" => "Keep only one employee per unique employee number in this batch, or correct the mistaken row.",
            "duplicateEmployeeNumberInTenant" => "Use a different employee number for this new employee or remove the row from the import.",
            "orgUnitNotFound" => "Replace this with an active org unit code that already exists in the tenant.",
            "orgUnitInactive" => "Replace this with an active org unit code that already exists in the tenant.",
            "ambiguousManagerEmail" => "Ensure the manager email appears only once in the uploaded file or references an existing employee.",
            "managerNotFound" => "Use a manager email that already exists in the tenant or appears as a valid unique employee in this upload.",
                "managerInactive" => "Use a manager email that belongs to an active employee in this tenant or leave it blank.",
            "selfManager" => "Replace the manager email with another employee or leave it blank.",
            "managerInvalidInBatch" => "Fix the referenced manager row first so this manager email resolves to a valid employee.",
            "managerCycle" => "Update the manager chain so it does not loop back to any employee in the same upload.",
            _ => "Fix the CSV data for this row and validate the batch again."
        };

    private static bool IsMissingRequiredFieldCode(string code)
        => code.StartsWith("missing", StringComparison.OrdinalIgnoreCase);

            private sealed record ExistingEmployeeReference(string Email, Guid Id, bool IsActive);

    private static bool IsValidEmail(string value)
    {
        try
        {
            var address = new MailAddress(value);
            return address.Address.Equals(value, StringComparison.OrdinalIgnoreCase);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static bool TryParseHireDate(string value, out DateTime hireDate)
    {
        if (DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
        {
            hireDate = DateTime.SpecifyKind(parsedDate.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
            return true;
        }

        hireDate = default;
        return false;
    }

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

    private static string? NormalizeEmployeeNumber(string? value)
        => NormalizeOptional(value)?.ToUpperInvariant();

    private static string? NormalizeOrgUnitCode(string? value)
        => NormalizeOptional(value)?.ToUpperInvariant();

    private sealed record ParsedCsvFile(
        IReadOnlyList<string> Headers,
        IReadOnlyList<EmployeeImportSourceRowDto> Rows);

    private sealed class CandidateRow(
        int rowNumber,
        string? employeeNumber,
        string? firstName,
        string? lastName,
        string? email,
        string? phone,
        string? hireDateText,
        DateTime? hireDate,
        string? jobTitle,
        string? workLocation,
        string? employmentType,
        string? orgUnitCode,
        string? managerEmail)
    {
        public int RowNumber { get; } = rowNumber;
        public string? EmployeeNumber { get; } = employeeNumber;
        public string? FirstName { get; } = firstName;
        public string? LastName { get; } = lastName;
        public string? Email { get; } = email;
        public string? Phone { get; } = phone;
        public string? HireDateText { get; } = hireDateText;
        public DateTime? HireDate { get; } = hireDate;
        public string? JobTitle { get; } = jobTitle;
        public string? WorkLocation { get; } = workLocation;
        public string? EmploymentType { get; } = employmentType;
        public string? OrgUnitCode { get; } = orgUnitCode;
        public string? ManagerEmail { get; } = managerEmail;
        public Guid? ResolvedOrgUnitId { get; set; }
        public Guid? ResolvedExistingManagerId { get; set; }
    }

    private sealed record StoredNormalizedRow(
        int RowNumber,
        string? EmployeeNumber,
        string FirstName,
        string LastName,
        string Email,
        string? Phone,
        DateTime HireDate,
        string? JobTitle,
        string? WorkLocation,
        string? EmploymentType,
        string? OrgUnitCode,
        Guid? OrgUnitId,
        string? ManagerEmail,
        Guid? ExistingManagerId);

    private sealed record StoredValidationIssue(
        int RowNumber,
        string? Field,
        string Severity,
        string Code,
        string Message,
        string? Category = null,
        string? GroupKey = null,
        string? Value = null,
        string? FixHint = null);

    private sealed record ValidationIssueKey(int RowNumber, string? Field, string Code);

    private sealed record ValidationResult(
        IReadOnlyList<StoredNormalizedRow> NormalizedRows,
        IReadOnlyList<StoredValidationIssue> Issues);

    private enum ManagerValidationState
    {
        Visiting,
        Valid,
        Invalid
    }
}

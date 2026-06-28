using System.Globalization;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using CsvHelper;
using CsvHelper.Configuration;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Employees.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.Workforce.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

public interface IEmployeeImportWorkflowService
{
    Task<EmployeeImportSchemaDto> GetSchemaAsync(CancellationToken cancellationToken);
    Task<(byte[] Content, string FileName)> BuildTemplateAsync(
        IReadOnlyCollection<string>? fields,
        CancellationToken cancellationToken);
    Task<EmployeeImportSessionDto> UploadAsync(IFormFile file, CancellationToken cancellationToken);
    Task<EmployeeImportSessionDto> UploadAsync(
        IFormFile file,
        DateTime batchEffectiveDate,
        EmployeeImportMode importMode,
        CancellationToken cancellationToken);
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
    Task<EmployeeImportApplyOperationDto> ApplyAsync(
        Guid sessionId,
        EmployeeImportActorDto actor,
        CancellationToken cancellationToken);
    Task<EmployeeImportApplyOperationDto> GetApplyOperationAsync(
        Guid sessionId,
        CancellationToken cancellationToken);
    Task ProcessApplyOperationAsync(
        Guid operationId,
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
    ITenantSettingsReadService? tenantSettingsReadService = null,
    IWorkforceCanonicalResolver? canonicalResolver = null,
    IWorkforceMutationService? mutationService = null) : IEmployeeImportWorkflowService
{
    private readonly ITenantSettingsReadService tenantSettingsReader =
        tenantSettingsReadService ?? new TenantSettingsReadService(dbContext);
    private readonly IWorkforceCanonicalResolver canonicalResolver =
        canonicalResolver ?? new WorkforceCanonicalResolver(dbContext);
    private readonly IWorkforceMutationService mutationService =
        mutationService ?? new WorkforceMutationService(dbContext, tenantContext, canonicalResolver ?? new WorkforceCanonicalResolver(dbContext));

    private const int MaxSourceFileNameLength = 260;
    private const int MaxApplyFailureReasonLength = 2000;
    private const int MaxRowCount = 5000;
    private const int SampleRowCount = 12;
    private const int DefaultPreviewPageSize = 5;
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
            "alex.manager@contoso.com"),
        new(
            "effectiveDate",
            "Effective date",
            false,
            "Optional row-level effective date (YYYY-MM-DD) that overrides the batch effective date for this row's business changes.",
            "2024-04-01")
    ];

    private static readonly HashSet<string> CanonicalFieldKeys =
        CanonicalFields.Select(field => field.Key).ToHashSet(StringComparer.Ordinal);

    public async Task<EmployeeImportSchemaDto> GetSchemaAsync(CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);
        return await BuildSchemaAsync(cancellationToken);
    }

    public async Task<(byte[] Content, string FileName)> BuildTemplateAsync(
        IReadOnlyCollection<string>? fields,
        CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);

        var selectedFields = fields is { Count: > 0 }
            ? ResolveTemplateFields(fields)
            : CanonicalFields;

        var headerLine = string.Join(",", selectedFields.Select(field => field.Key));
        return (Encoding.UTF8.GetBytes($"{headerLine}\r\n"), "employee-import-template.csv");
    }

    public Task<EmployeeImportSessionDto> UploadAsync(IFormFile file, CancellationToken cancellationToken)
        => UploadAsync(file, DateTime.UtcNow, EmployeeImportMode.BusinessChange, cancellationToken);

    public async Task<EmployeeImportSessionDto> UploadAsync(
        IFormFile file,
        DateTime batchEffectiveDate,
        EmployeeImportMode importMode,
        CancellationToken cancellationToken)
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
            "[]",
            DateTime.UtcNow.Add(SessionLifetime),
            batchEffectiveDate,
            importMode);

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
        var previewRows = BuildPreviewRows(sourceRows);

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

        if (session.Stage == EmployeeImportStage.Applying)
        {
            throw new ArgumentException("This employee import session is currently applying.", nameof(sessionId));
        }

        if (session.Stage == EmployeeImportStage.Expired)
        {
            throw new ArgumentException("Upload expired. Upload the file again to continue.", nameof(sessionId));
        }

        var sourceRows = Deserialize<List<EmployeeImportSourceRowDto>>(session.SourceRowsJson) ?? [];
        var headers = Deserialize<List<string>>(session.SourceHeadersJson) ?? [];
        var settings = await tenantSettingsReader.GetCurrentAsync(cancellationToken);
        var validation = await ValidateRowsAsync(
            sourceRows, headers, settings, session.BatchEffectiveDate, session.ImportMode, cancellationToken);

        session.SetValidationResult(
            JsonSerializer.Serialize(validation.NormalizedRows, JsonOptions),
            JsonSerializer.Serialize(validation.Issues, JsonOptions));

        await dbContext.SaveChangesAsync(cancellationToken);

        var previewRows = BuildPreviewRows(sourceRows);

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

    public async Task<EmployeeImportApplyOperationDto> ApplyAsync(
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
            throw new ArgumentException("This employee import session has already been applied.", nameof(sessionId));

        if (session.Stage == EmployeeImportStage.Expired)
            throw new ArgumentException("Upload expired. Upload the file again to continue.", nameof(sessionId));

        if (session.Stage == EmployeeImportStage.Applying)
            throw new ArgumentException("This employee import session is already applying.", nameof(sessionId));

        if (session.Stage != EmployeeImportStage.Validated)
            throw new ArgumentException("Validate the import before applying it.", nameof(sessionId));

        var validationIssues = ReadRequiredValidationIssues(session);
        if (validationIssues.Any(issue => issue.Severity.Equals("error", StringComparison.OrdinalIgnoreCase)))
            throw new ArgumentException("The import contains validation errors. Fix them before applying.", nameof(sessionId));

        var activeOperationExists = await dbContext.EmployeeImportApplyOperations
            .AnyAsync(
                operation => operation.SessionId == sessionId
                    && operation.Status != EmployeeImportApplyOperationStatus.Succeeded
                    && operation.Status != EmployeeImportApplyOperationStatus.Failed,
                cancellationToken);
        if (activeOperationExists)
            throw new ArgumentException("This employee import session is already applying.", nameof(sessionId));

        var normalizedRows = ReadNormalizedRows(session);
        if (normalizedRows.Count == 0)
            throw new ArgumentException("The import does not contain any valid employee rows to apply.", nameof(sessionId));
        var sourceRows = ReadSourceRows(session);

        var operation = EmployeeImportApplyOperation.Queue(
            tenantContext.TenantId,
            session.Id,
            actor.UserId,
            actor.FullName,
            actor.Role,
            sourceRows.Count,
            normalizedRows.Count,
            DateTime.UtcNow);
        session.MarkApplying();

        dbContext.EmployeeImportApplyOperations.Add(operation);
        await dbContext.SaveChangesAsync(cancellationToken);

        return BuildApplyOperationDto(operation);
    }

    public async Task<EmployeeImportApplyOperationDto> GetApplyOperationAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);

        _ = await dbContext.EmployeeImportSessions
            .FirstOrDefaultAsync(current => current.Id == sessionId, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(EmployeeImportSession), sessionId);

        var operation = await dbContext.EmployeeImportApplyOperations
            .AsNoTracking()
            .Where(current => current.SessionId == sessionId)
            .OrderByDescending(current => current.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new EntityNotFoundException(nameof(EmployeeImportApplyOperation), sessionId);

        return BuildApplyOperationDto(operation);
    }

    public async Task ProcessApplyOperationAsync(
        Guid operationId,
        CancellationToken cancellationToken)
    {
        await EnsureImportAvailableAsync(cancellationToken);

        var operation = await dbContext.EmployeeImportApplyOperations
            .FirstOrDefaultAsync(current => current.Id == operationId, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(EmployeeImportApplyOperation), operationId);

        if (operation.Status is EmployeeImportApplyOperationStatus.Succeeded or EmployeeImportApplyOperationStatus.Failed)
            return;

        var session = await dbContext.EmployeeImportSessions
            .FirstOrDefaultAsync(current => current.Id == operation.SessionId, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(EmployeeImportSession), operation.SessionId);

        operation.MarkRunning(DateTime.UtcNow);
        session.MarkApplying();
        await dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            var result = await ApplyValidatedSessionAsync(session, operation, cancellationToken);
            operation.MarkSucceeded(
                result.HistoryId,
                result.SourceRowCount,
                result.ValidatedRowCount,
                result.CreatedCount,
                result.PublishedRowCount,
                result.AppliedAt);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            session.RestoreValidated();
            operation.MarkFailed(TrimFailureReason(ex.Message), DateTime.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<EmployeeImportApplyResultDto> ApplyValidatedSessionAsync(
        EmployeeImportSession session,
        EmployeeImportApplyOperation operation,
        CancellationToken cancellationToken)
    {
        await MarkExpiredIfNeededAsync(session, cancellationToken);

        if (session.Stage == EmployeeImportStage.Applied)
            throw new ArgumentException("This employee import session has already been applied.", nameof(session));

        if (session.Stage == EmployeeImportStage.Expired)
            throw new ArgumentException("Upload expired. Upload the file again to continue.", nameof(session));

        if (session.Stage is not EmployeeImportStage.Validated and not EmployeeImportStage.Applying)
            throw new ArgumentException("Validate the import before applying it.", nameof(session));

        var validationIssues = ReadRequiredValidationIssues(session);
        if (validationIssues.Any(issue => issue.Severity.Equals("error", StringComparison.OrdinalIgnoreCase)))
            throw new ArgumentException("The import contains validation errors. Fix them before applying.", nameof(session));

        var normalizedRows = ReadNormalizedRows(session);
        if (normalizedRows.Count == 0)
            throw new ArgumentException("The import does not contain any valid employee rows to apply.", nameof(session));

        var headers = Deserialize<List<string>>(session.SourceHeadersJson) ?? [];
        var sourceRows = ReadSourceRows(session);
        var settings = await tenantSettingsReader.GetCurrentAsync(cancellationToken);

        var createRows = normalizedRows.Where(r => r.Classification == EmployeeImportRowClassification.Create).ToList();
        var unchangedRows = normalizedRows.Where(r => r.Classification == EmployeeImportRowClassification.Unchanged).ToList();
        var changeRows = normalizedRows.Where(r => r.Classification is not (
            EmployeeImportRowClassification.Create
            or EmployeeImportRowClassification.Unchanged
            or EmployeeImportRowClassification.Invalid
            or EmployeeImportRowClassification.Conflicting)).ToList();
        var processedRowCount = 0;

        async Task PersistProgressAsync(bool force = false)
        {
            if (processedRowCount <= operation.ProcessedRowCount)
                return;

            if (!force && processedRowCount % 25 != 0)
                return;

            operation.RecordProgress(processedRowCount);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (createRows.Count > 0)
        {
            var createEmails = createRows
                .Where(r => !string.IsNullOrWhiteSpace(r.Email))
                .Select(r => r.Email!)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var conflictingEmails = await dbContext.Employees
                .AsNoTracking()
                .Where(e => createEmails.Contains(e.Email))
                .Select(e => e.Email)
                .ToListAsync(cancellationToken);
            if (conflictingEmails.Count > 0)
                throw new ArgumentException(
                    "One or more employee emails already exist in this tenant. Validate the file again before applying.");
        }

        CheckSameFileManagerCycles(createRows, nameof(session));

        await PreloadApplyStateAsync(normalizedRows, cancellationToken);

        var originalAutoDetect = dbContext.ChangeTracker.AutoDetectChangesEnabled;
        dbContext.ChangeTracker.AutoDetectChangesEnabled = false;
        var useTransaction = !string.Equals(
            dbContext.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.OrdinalIgnoreCase);
        await using var transaction = useTransaction
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        try
        {
            var createdEmployeesByEmail = new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase);

            foreach (var row in createRows)
            {
                var hireDate = row.HireDate != default ? row.HireDate : row.ResolvedEffectiveDate;
                var employee = Employee.Create(
                    tenantContext.TenantId,
                    row.FirstName,
                    row.LastName,
                    row.Email,
                    hireDate,
                    null,
                    row.JobTitle,
                    row.EmployeeNumber,
                    row.Phone,
                    row.WorkLocation,
                    row.EmploymentType);

                dbContext.Employees.Add(employee);
                createdEmployeesByEmail[row.Email] = employee;

                var empResult = await mutationService.StartEmploymentAsync(
                    employee.Id,
                    new StartEmploymentInput(hireDate, row.EmploymentType, WorkforceSourceType.Import, session.SourceFileName, session.Id),
                    operation.ActorFullName,
                    cancellationToken);
                if (empResult.IsFailure)
                    throw new ArgumentException(
                        $"Row {row.RowNumber}: Could not start employment: {empResult.Error.Message} Validate the file again before applying.");

                if (row.OrgUnitId.HasValue)
                {
                    var jobTitle = row.JobTitle ?? string.Empty;
                    var waResult = await mutationService.ChangeWorkAssignmentAsync(
                        employee.Id,
                        new ChangeWorkAssignmentInput(
                            row.OrgUnitId.Value,
                            jobTitle,
                            row.WorkLocation,
                            row.ResolvedEffectiveDate,
                            WorkforceSourceType.Import,
                            session.SourceFileName,
                            session.Id),
                        operation.ActorFullName,
                        cancellationToken);
                    if (waResult.IsFailure)
                        throw new ArgumentException(
                            $"Row {row.RowNumber}: Could not create work assignment: {waResult.Error.Message} Validate the file again before applying.");
                }

                processedRowCount++;
                await PersistProgressAsync();
            }

            foreach (var row in createRows.Where(r => !string.IsNullOrWhiteSpace(r.ManagerEmail)))
            {
                var employee = createdEmployeesByEmail[row.Email];
                var managerId = row.ExistingManagerId;

                if (!managerId.HasValue)
                {
                    if (!createdEmployeesByEmail.TryGetValue(row.ManagerEmail!, out var sameFileManager))
                        throw new ArgumentException(
                            "The saved import session is no longer valid. Validate the file again before applying.");
                    managerId = sameFileManager.Id;
                }

                if (row.OrgUnitId.HasValue)
                {
                    var managerResult = await mutationService.ChangeManagerAsync(
                        employee.Id,
                        new ChangeManagerInput(
                            managerId.Value,
                            row.ResolvedEffectiveDate,
                            WorkforceSourceType.Import,
                            session.SourceFileName,
                            session.Id),
                        operation.ActorFullName,
                        cancellationToken);
                    if (managerResult.IsFailure)
                        throw new ArgumentException(
                            $"Row {row.RowNumber}: Could not assign manager: {managerResult.Error.Message} Validate the file again before applying.");
                }
            }

            foreach (var row in changeRows)
            {
                var matchedId = row.MatchedEmployeeId!.Value;
                var effectiveDate = row.ResolvedEffectiveDate;

                if (row.ProfileChanged)
                {
                    var existingEmployee = await FindTrackedEmployeeAsync(matchedId, cancellationToken)
                        ?? throw new ArgumentException(
                            $"Row {row.RowNumber}: Matched employee {matchedId} no longer exists. Validate the file again before applying.");
                    var phone = HeaderPresent(headers, "phone") ? row.Phone : existingEmployee.Phone;
                    var profileResult = await mutationService.UpdateEmployeeProfileAsync(
                        matchedId,
                        new UpdateEmployeeProfileInput(
                            row.FirstName,
                            row.LastName,
                            row.Email,
                            existingEmployee.PreferredName,
                            phone),
                        operation.ActorFullName,
                        cancellationToken);
                    if (profileResult.IsFailure)
                        throw new ArgumentException(
                            $"Row {row.RowNumber}: Profile update failed: {profileResult.Error.Message} Validate the file again before applying.");
                }

                if (row.EmploymentChanged)
                {
                    var empResult = await mutationService.UpdateEmploymentDetailsAsync(
                        matchedId,
                        new UpdateEmploymentDetailsInput(
                            row.EmploymentType,
                            WorkforceSourceType.Import,
                            session.SourceFileName,
                            session.Id),
                        operation.ActorFullName,
                        cancellationToken);
                    if (empResult.IsFailure)
                        throw new ArgumentException(
                            $"Row {row.RowNumber}: Employment update failed: {empResult.Error.Message} Validate the file again before applying.");
                }

                if (row.WorkAssignmentChanged)
                {
                    var existingAssignment = await ResolveTrackedPrimaryWorkAssignmentAsync(
                        matchedId,
                        effectiveDate,
                        cancellationToken);
                    var orgUnitId = row.OrgUnitId ?? existingAssignment?.OrgUnitId;
                    var jobTitle = row.JobTitle ?? existingAssignment?.JobTitle;
                    var workLocation = row.WorkLocation ?? existingAssignment?.WorkLocation;

                    if (orgUnitId is null || jobTitle is null)
                        throw new ArgumentException(
                            $"Row {row.RowNumber}: Cannot apply work assignment change — org unit or job title is missing. Validate the file again before applying.");

                    if (session.ImportMode == EmployeeImportMode.Correction)
                    {
                        var waResult = await mutationService.CorrectPrimaryWorkAssignmentAsync(
                            matchedId,
                            new CorrectWorkAssignmentInput(
                                orgUnitId.Value,
                                jobTitle,
                                workLocation,
                                WorkforceSourceType.Import,
                                session.SourceFileName,
                                session.Id),
                            operation.ActorFullName,
                            cancellationToken);
                        if (waResult.IsFailure)
                            throw new ArgumentException(
                                $"Row {row.RowNumber}: Work assignment correction failed: {waResult.Error.Message} Validate the file again before applying.");
                    }
                    else
                    {
                        var waResult = await mutationService.ChangeWorkAssignmentAsync(
                            matchedId,
                            new ChangeWorkAssignmentInput(
                                orgUnitId.Value,
                                jobTitle,
                                workLocation,
                                effectiveDate,
                                WorkforceSourceType.Import,
                                session.SourceFileName,
                                session.Id),
                            operation.ActorFullName,
                            cancellationToken);
                        if (waResult.IsFailure)
                            throw new ArgumentException(
                                $"Row {row.RowNumber}: Work assignment change failed: {waResult.Error.Message} Validate the file again before applying.");
                    }
                }

                if (row.ManagerChanged)
                {
                    var managerId = row.ExistingManagerId;
                    if (!managerId.HasValue
                        && !string.IsNullOrWhiteSpace(row.ManagerEmail)
                        && createdEmployeesByEmail.TryGetValue(row.ManagerEmail!, out var sameFileNewEmployee))
                    {
                        managerId = sameFileNewEmployee.Id;
                    }

                    if (!managerId.HasValue)
                        throw new ArgumentException(
                            $"Row {row.RowNumber}: Cannot resolve manager '{row.ManagerEmail}'. Validate the file again before applying.");

                    var managerResult = await mutationService.ChangeManagerAsync(
                        matchedId,
                        new ChangeManagerInput(
                            managerId.Value,
                            effectiveDate,
                            WorkforceSourceType.Import,
                            session.SourceFileName,
                            session.Id),
                        operation.ActorFullName,
                        cancellationToken);
                    if (managerResult.IsFailure)
                        throw new ArgumentException(
                            $"Row {row.RowNumber}: Manager change failed: {managerResult.Error.Message} Validate the file again before applying.");
                }

                processedRowCount++;
                await PersistProgressAsync();
            }

            await PersistProgressAsync(force: true);

            dbContext.ChangeTracker.DetectChanges();

            var appliedAt = DateTime.UtcNow;
            var history = EmployeeImportHistory.CreateApplied(
                tenantContext.TenantId,
                session.Id,
                session.SourceFileName,
                session.SourceFileSizeBytes,
                sourceRows.Count,
                normalizedRows.Count,
                createRows.Count,
                unchangedRows.Count,
                createRows.Count + changeRows.Count,
                appliedAt,
                operation.ActorUserId,
                operation.ActorFullName,
                operation.ActorRole);

            var importFollowUpIssues = BuildImportFollowUpIssues(history.Id, createdEmployeesByEmail, createRows, settings);

            dbContext.EmployeeImportHistories.Add(history);
            if (importFollowUpIssues.Count > 0)
                dbContext.EmployeeImportFollowUpIssues.AddRange(importFollowUpIssues);

            session.MarkApplied(appliedAt);
            await dbContext.SaveChangesAsync(cancellationToken);

            if (transaction is not null)
                await transaction.CommitAsync(cancellationToken);

            return new EmployeeImportApplyResultDto(
                session.Id,
                history.Id,
                session.SourceFileName,
                sourceRows.Count,
                normalizedRows.Count,
                createRows.Count,
                createRows.Count + changeRows.Count,
                appliedAt,
                session.Stage);
        }
        catch
        {
            if (transaction is not null)
                await transaction.RollbackAsync(cancellationToken);
            throw;
        }
        finally
        {
            dbContext.ChangeTracker.AutoDetectChangesEnabled = originalAutoDetect;
        }
    }

    private async Task PreloadApplyStateAsync(
        IReadOnlyList<StoredNormalizedRow> normalizedRows,
        CancellationToken cancellationToken)
    {
        var matchedEmployeeIds = normalizedRows
            .Where(row => row.MatchedEmployeeId.HasValue)
            .Select(row => row.MatchedEmployeeId!.Value);
        var managerEmployeeIds = normalizedRows
            .Where(row => row.ExistingManagerId.HasValue)
            .Select(row => row.ExistingManagerId!.Value);
        var employeeIds = matchedEmployeeIds
            .Concat(managerEmployeeIds)
            .Distinct()
            .ToArray();

        var orgUnitIds = normalizedRows
            .Where(row => row.OrgUnitId.HasValue)
            .Select(row => row.OrgUnitId!.Value)
            .Distinct()
            .ToArray();

        if (employeeIds.Length > 0)
        {
            _ = await dbContext.Employees
                .Where(employee => employeeIds.Contains(employee.Id))
                .ToListAsync(cancellationToken);
            _ = await dbContext.Employments
                .Where(employment => employeeIds.Contains(employment.EmployeeId))
                .ToListAsync(cancellationToken);
            _ = await dbContext.WorkAssignments
                .Where(assignment => employeeIds.Contains(assignment.EmployeeId))
                .ToListAsync(cancellationToken);
            _ = await dbContext.ManagerRelationships
                .Where(relationship =>
                    employeeIds.Contains(relationship.SubjectEmployeeId)
                    || employeeIds.Contains(relationship.ManagerEmployeeId))
                .ToListAsync(cancellationToken);
        }

        if (orgUnitIds.Length > 0)
        {
            _ = await dbContext.OrgUnits
                .Where(orgUnit => orgUnitIds.Contains(orgUnit.Id))
                .ToListAsync(cancellationToken);
        }
    }

    private async Task<Employee?> FindTrackedEmployeeAsync(Guid employeeId, CancellationToken cancellationToken)
    {
        var local = dbContext.Employees.Local.FirstOrDefault(employee => employee.Id == employeeId);
        return local ?? await dbContext.Employees.FirstOrDefaultAsync(employee => employee.Id == employeeId, cancellationToken);
    }

    private async Task<PrimaryWorkAssignmentSnapshot?> ResolveTrackedPrimaryWorkAssignmentAsync(
        Guid employeeId,
        DateTime asOf,
        CancellationToken cancellationToken)
    {
        var local = dbContext.WorkAssignments.Local
            .Where(assignment =>
                assignment.EmployeeId == employeeId
                && assignment.IsPrimary
                && assignment.EffectiveFrom <= asOf
                && (assignment.EffectiveTo == null || asOf < assignment.EffectiveTo))
            .OrderByDescending(assignment => assignment.EffectiveFrom)
            .FirstOrDefault();

        if (local is not null)
        {
            return new PrimaryWorkAssignmentSnapshot(
                local.Id,
                local.EmploymentId,
                local.OrgUnitId,
                local.JobTitle,
                local.WorkLocation,
                local.EffectiveFrom,
                local.EffectiveTo);
        }

        return await canonicalResolver.GetPrimaryWorkAssignmentAsync(employeeId, asOf, cancellationToken);
    }

    private static string TrimFailureReason(string message)
        => string.IsNullOrWhiteSpace(message)
            ? "Employee import apply failed."
            : message.Length <= MaxApplyFailureReasonLength
                ? message
                : message[..MaxApplyFailureReasonLength];

    private static List<EmployeeImportPreviewRowDto> BuildPreviewRows(
        IReadOnlyCollection<EmployeeImportSourceRowDto> sourceRows)
        => sourceRows.Select(CreatePreviewRow).ToList();

    private static void CheckSameFileManagerCycles(IReadOnlyList<StoredNormalizedRow> createRows, string paramName)
    {
        var createEmailSet = createRows
            .Where(r => !string.IsNullOrWhiteSpace(r.Email))
            .Select(r => r.Email!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Only track in-file same-file manager edges (ExistingManagerId is null = manager is another create row)
        var inFileManagerMap = createRows
            .Where(r => !string.IsNullOrWhiteSpace(r.Email)
                && !string.IsNullOrWhiteSpace(r.ManagerEmail)
                && r.ExistingManagerId is null
                && createEmailSet.Contains(r.ManagerEmail!))
            .ToDictionary(r => r.Email!, r => r.ManagerEmail!, StringComparer.OrdinalIgnoreCase);

        foreach (var startEmail in inFileManagerMap.Keys)
        {
            var chain = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var current = startEmail;

            while (current is not null && inFileManagerMap.TryGetValue(current, out var managerEmail))
            {
                if (!chain.Add(current))
                    throw new ArgumentException(
                        "A manager reporting cycle was detected. The saved import session is no longer valid. Validate the file again before applying.",
                        paramName);
                current = managerEmail;
            }
        }
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

    private static bool IsFieldRequiredForImport(
        IReadOnlyList<string> sourceHeaders,
        string fieldKey,
        TenantSettingsDto settings,
        bool fallbackRequired)
        => CanonicalFieldKeys.Contains(fieldKey)
        && sourceHeaders.Select(CleanHeader).Contains(fieldKey)
        && ResolveImportFieldRequired(fieldKey, settings, fallbackRequired);

    private static IReadOnlyList<EmployeeImportCanonicalFieldDto> ResolveTemplateFields(
        IReadOnlyCollection<string> fields)
    {
        var requestedFieldKeys = fields
            .Select(CleanHeader)
            .Where(field => !string.IsNullOrWhiteSpace(field))
            .ToHashSet(StringComparer.Ordinal);

        return CanonicalFields
            .Where(field => requestedFieldKeys.Contains(field.Key))
            .ToList();
    }

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
        // Headers must be a subset of the canonical columns, presented in canonical order, with no
        // duplicates, and must include the operationally required fields. This naturally supports
        // optional columns (employee number, phone, work location, employment type, effective date)
        // without enumerating every legacy combination.
        var canonicalOrder = CanonicalFields
            .Select((field, index) => (field.Key, index))
            .ToDictionary(entry => entry.Key, entry => entry.index, StringComparer.Ordinal);

        var cleaned = actualHeaders.Select(CleanHeader).ToList();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var lastOrder = -1;

        foreach (var header in cleaned)
        {
            if (!canonicalOrder.TryGetValue(header, out var order)
                || !seen.Add(header)
                || order <= lastOrder)
            {
                throw new ArgumentException(
                    "Use the official employee import template. Column headers must match exactly in the expected order.");
            }

            lastOrder = order;
        }

        // Identity columns must always be present; hire-date completeness is enforced per row for
        // creates so controlled-update files can omit columns they do not change.
        if (!RequiredTemplateHeaderKeys.All(required => seen.Contains(required)))
        {
            throw new ArgumentException(
                "Use the official employee import template. Column headers must match exactly in the expected order.");
        }
    }

    private static readonly string[] RequiredTemplateHeaderKeys = ["firstName", "lastName", "email"];

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
        row.Values.TryGetValue("effectiveDate", out var effectiveDate);

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
            NormalizeEmail(managerEmail),
            NormalizeOptional(effectiveDate));
    }

    private async Task<ValidationResult> ValidateRowsAsync(
        IReadOnlyCollection<EmployeeImportSourceRowDto> sourceRows,
        IReadOnlyList<string> sourceHeaders,
        TenantSettingsDto settings,
        DateTime batchEffectiveDate,
        EmployeeImportMode importMode,
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

            if (IsFieldRequiredForImport(sourceHeaders, "lastName", settings, true)
                && string.IsNullOrWhiteSpace(lastName))
            {
                AddIssue(issues, issueKeys, sourceRow.RowNumber, "lastName", "missingLastName", "Last name is required.", rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
            }

            if (IsFieldRequiredForImport(sourceHeaders, "email", settings, true)
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
            if (IsFieldRequiredForImport(sourceHeaders, "hireDate", settings, true)
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

            if (IsFieldRequiredForImport(sourceHeaders, "jobTitle", settings, false)
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

            DateTime? rowEffectiveDate = null;
            var effectiveDateText = ReadValue(sourceRow, "effectiveDate");
            if (!string.IsNullOrWhiteSpace(effectiveDateText))
            {
                if (TryParseHireDate(effectiveDateText, out var parsedEffectiveDate))
                {
                    rowEffectiveDate = parsedEffectiveDate;
                }
                else
                {
                    AddIssue(issues, issueKeys, sourceRow.RowNumber, "effectiveDate", "invalidEffectiveDate",
                        "Effective date must use YYYY-MM-DD format.", value: effectiveDateText,
                        rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
                }
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
                managerEmail)
            {
                RowEffectiveDate = rowEffectiveDate
            });
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
            .Select(employee => new ExistingEmployeeReference(
                employee.Email,
                employee.Id,
                dbContext.Employments.Any(employment =>
                    employment.EmployeeId == employee.Id
                    && employment.Status == EmploymentStatus.Active
                    && employment.EffectiveTo == null)))
            .ToListAsync(cancellationToken);

        var existingEmployeesByEmailLookup = existingEmployeesByEmail
            .GroupBy(employee => employee.Email, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var employeeNumbers = candidates
            .Where(candidate => !string.IsNullOrWhiteSpace(candidate.EmployeeNumber))
            .Select(candidate => candidate.EmployeeNumber!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        // Match rows to existing employees by tenant-scoped employee number (never by email): a
        // matched number is a controlled-update candidate, not a duplicate. Email remains identity.
        var matchedEmployees = employeeNumbers.Count == 0
            ? new List<ExistingEmployeeMatch>()
            : await dbContext.Employees
                .AsNoTracking()
                .Where(employee => employee.EmployeeNumber != null && employeeNumbers.Contains(employee.EmployeeNumber))
                .Select(employee => new ExistingEmployeeMatch(
                    employee.EmployeeNumber!, employee.Id, employee.Email,
                    employee.FirstName, employee.LastName, employee.Phone))
                .ToListAsync(cancellationToken);
        var matchByNumber = matchedEmployees
            .GroupBy(match => match.EmployeeNumber, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in candidates)
        {
            if (!string.IsNullOrWhiteSpace(candidate.EmployeeNumber)
                && matchByNumber.TryGetValue(candidate.EmployeeNumber, out var match))
            {
                candidate.MatchedEmployeeId = match.Id;
                candidate.MatchedEmployee = match;
            }

            // Email is identity, not a match key: a row whose email belongs to a DIFFERENT existing
            // employee is a hard conflict; a Create row colliding with any existing email is blocked.
            if (!string.IsNullOrWhiteSpace(candidate.Email)
                && existingEmployeesByEmailLookup.TryGetValue(candidate.Email, out var emailOwner)
                && emailOwner.Id != candidate.MatchedEmployeeId)
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

        // Classify each valid row against canonical facts as of its resolved effective date, and
        // apply batch-mode safety rules (correction batches never create; manager corrections blocked).
        foreach (var candidate in candidates)
        {
            candidate.ResolvedEffectiveDate = candidate.RowEffectiveDate ?? batchEffectiveDate;

            if (HasErrors(rowErrorNumbers, candidate.RowNumber))
            {
                candidate.Classification = EmployeeImportRowClassification.Invalid;
                continue;
            }

            if (candidate.MatchedEmployeeId is not { } matchedId)
            {
                candidate.Classification = EmployeeImportRowClassification.Create;

                // For new employees the work-assignment effective date must not precede the hire date
                // (covers both a row-level override and a batch-date that lands before the hire date).
                if (candidate.HireDate.HasValue && candidate.ResolvedEffectiveDate < candidate.HireDate.Value)
                {
                    AddIssue(issues, issueKeys, candidate.RowNumber, "effectiveDate", "effectiveDateBeforeHireDate",
                        "The effective date must not be before the hire date.",
                        rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
                    candidate.Classification = EmployeeImportRowClassification.Invalid;
                    continue;
                }

                if (importMode == EmployeeImportMode.Correction)
                {
                    AddIssue(issues, issueKeys, candidate.RowNumber, "employeeNumber", "createInCorrectionBatch",
                        "Correction batches cannot create new workers. Use a business-change import for new hires.",
                        rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
                    candidate.Classification = EmployeeImportRowClassification.Conflicting;
                }

                continue;
            }

            var asOf = candidate.ResolvedEffectiveDate;
            var employment = await canonicalResolver.GetCurrentEmploymentAsync(matchedId, asOf, cancellationToken);
            var assignment = await canonicalResolver.GetPrimaryWorkAssignmentAsync(matchedId, asOf, cancellationToken);
            var manager = await canonicalResolver.GetPrimaryManagerAsync(matchedId, asOf, cancellationToken);
            var matchedEmployee = candidate.MatchedEmployee!;

            // If no active employment as-of the effective date, check whether employment exists but
            // hasn't started yet (gives a more specific error than "no active employment").
            if (employment == null)
            {
                var earliestStart = await dbContext.Employments
                    .AsNoTracking()
                    .Where(e => e.EmployeeId == matchedId)
                    .OrderBy(e => e.EffectiveFrom)
                    .Select(e => (DateTime?)e.EffectiveFrom)
                    .FirstOrDefaultAsync(cancellationToken);

                if (earliestStart.HasValue && asOf < earliestStart.Value)
                {
                    AddIssue(issues, issueKeys, candidate.RowNumber, "effectiveDate", "effectiveDateBeforeEmploymentStart",
                        $"Effective date ({asOf:yyyy-MM-dd}) is before this employee's employment start date ({earliestStart.Value:yyyy-MM-dd}).",
                        value: asOf.ToString("yyyy-MM-dd"),
                        rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
                    candidate.Classification = EmployeeImportRowClassification.Invalid;
                    continue;
                }
            }

            candidate.ProfileChanged =
                !ValuesEqual(candidate.FirstName, matchedEmployee.FirstName)
                || !ValuesEqual(candidate.LastName, matchedEmployee.LastName)
                || !ValuesEqual(candidate.Email, matchedEmployee.Email)
                || (HeaderPresent(sourceHeaders, "phone") && !ValuesEqual(candidate.Phone, matchedEmployee.Phone));

            candidate.EmploymentChanged = HeaderPresent(sourceHeaders, "employmentType")
                && !ValuesEqual(candidate.EmploymentType, employment?.EmploymentType);

            candidate.WorkAssignmentChanged =
                (HeaderPresent(sourceHeaders, "orgUnitCode") && candidate.ResolvedOrgUnitId is { } orgId && orgId != assignment?.OrgUnitId)
                || (HeaderPresent(sourceHeaders, "jobTitle") && !ValuesEqual(candidate.JobTitle, assignment?.JobTitle))
                || (HeaderPresent(sourceHeaders, "workLocation") && !ValuesEqual(candidate.WorkLocation, assignment?.WorkLocation));

            candidate.ManagerChanged = HeaderPresent(sourceHeaders, "managerEmail")
                && !string.IsNullOrWhiteSpace(candidate.ManagerEmail)
                && (candidate.ResolvedExistingManagerId is not { } existingManagerId
                    || manager?.ManagerEmployeeId != existingManagerId);

            if (importMode == EmployeeImportMode.Correction && candidate.ManagerChanged)
            {
                AddIssue(issues, issueKeys, candidate.RowNumber, "managerEmail", "managerCorrectionUnsupported",
                    "Manager corrections are not supported in a correction batch. Use the change-manager action.",
                    value: candidate.ManagerEmail, rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
                candidate.Classification = EmployeeImportRowClassification.Conflicting;
                continue;
            }

            candidate.Classification =
                candidate.ManagerChanged ? EmployeeImportRowClassification.ManagerChange
                : candidate.WorkAssignmentChanged ? EmployeeImportRowClassification.WorkAssignmentChange
                : candidate.EmploymentChanged ? EmployeeImportRowClassification.EmploymentChange
                : candidate.ProfileChanged ? EmployeeImportRowClassification.ProfileCorrection
                : EmployeeImportRowClassification.Unchanged;

            // Reject employment/assignment/manager changes when there is no active employment as of the effective date
            if (employment == null
                && candidate.Classification is EmployeeImportRowClassification.EmploymentChange
                    or EmployeeImportRowClassification.WorkAssignmentChange
                    or EmployeeImportRowClassification.ManagerChange)
            {
                AddIssue(issues, issueKeys, candidate.RowNumber, "effectiveDate", "noActiveEmploymentAtEffectiveDate",
                    $"This employee has no active employment as of {candidate.ResolvedEffectiveDate:yyyy-MM-dd}. Use the rehire action to start a new employment period first.",
                    rowErrorNumbers: rowErrorNumbers, issueCodesByRow: issueCodesByRow);
                candidate.Classification = EmployeeImportRowClassification.Conflicting;
            }
        }

        var normalizedRows = candidates
            .Where(candidate => !HasErrors(rowErrorNumbers, candidate.RowNumber)
                && (!IsFieldRequiredForImport(sourceHeaders, "firstName", settings, true)
                    || !string.IsNullOrWhiteSpace(candidate.FirstName))
                && (!IsFieldRequiredForImport(sourceHeaders, "lastName", settings, true)
                    || !string.IsNullOrWhiteSpace(candidate.LastName))
                && (!IsFieldRequiredForImport(sourceHeaders, "email", settings, true)
                    || !string.IsNullOrWhiteSpace(candidate.Email))
                // Field-completeness rules govern new-employee creation; controlled updates only
                // touch the facts their row actually supplies.
                && (candidate.MatchedEmployeeId is not null
                    || ((!ResolveImportFieldRequired("phone", settings, false)
                            || !string.IsNullOrWhiteSpace(candidate.Phone))
                        && (!ResolveImportFieldRequired("hireDate", settings, true)
                            || candidate.HireDate.HasValue)
                        && (!ResolveImportFieldRequired("jobTitle", settings, false)
                            || !string.IsNullOrWhiteSpace(candidate.JobTitle))
                        && (!ResolveImportFieldRequired("workLocation", settings, false)
                            || !string.IsNullOrWhiteSpace(candidate.WorkLocation))
                        && (!ResolveImportFieldRequired("employmentType", settings, false)
                            || !string.IsNullOrWhiteSpace(candidate.EmploymentType)))))
            .Select(candidate => new StoredNormalizedRow(
                candidate.RowNumber,
                candidate.EmployeeNumber,
                candidate.FirstName!,
                candidate.LastName!,
                candidate.Email!,
                candidate.Phone,
                candidate.HireDate ?? candidate.ResolvedEffectiveDate,
                candidate.JobTitle,
                candidate.WorkLocation,
                candidate.EmploymentType,
                candidate.OrgUnitCode,
                candidate.ResolvedOrgUnitId,
                candidate.ManagerEmail,
                candidate.ResolvedExistingManagerId,
                candidate.Classification,
                candidate.ResolvedEffectiveDate,
                candidate.MatchedEmployeeId,
                candidate.ProfileChanged,
                candidate.EmploymentChanged,
                candidate.WorkAssignmentChanged,
                candidate.ManagerChanged))
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
        var latestApplyOperation = await dbContext.EmployeeImportApplyOperations
            .AsNoTracking()
            .Where(operation => operation.SessionId == session.Id)
            .OrderByDescending(operation => operation.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return BuildSessionDto(
            session,
            headers,
            sourceRows,
            previewRows,
            schema,
            latestApplyOperation is null ? null : BuildApplyOperationDto(latestApplyOperation),
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
        EmployeeImportApplyOperationDto? lastApplyOperation,
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
            session.Stage is EmployeeImportStage.Validated or EmployeeImportStage.Applying or EmployeeImportStage.Applied);
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

        // Surface classification, resolved effective date, matched identity, and the full change set
        // on the previewed rows once the batch has been validated.
        var isValidatedStage = session.Stage is EmployeeImportStage.Validated or EmployeeImportStage.Applying or EmployeeImportStage.Applied;
        if (isValidatedStage)
        {
            var normalizedByRow = ReadNormalizedRowsSafe(session)
                .GroupBy(row => row.RowNumber)
                .ToDictionary(group => group.Key, group => group.First());
            var errorRowNumbers = validationIssues
                .Where(issue => issue.Severity.Equals("error", StringComparison.OrdinalIgnoreCase))
                .Select(issue => issue.RowNumber)
                .ToHashSet();

            previewWindow = previewWindow
                .Select(row => normalizedByRow.TryGetValue(row.RowNumber, out var normalized)
                    ? row with
                    {
                        Classification = normalized.Classification,
                        ResolvedEffectiveDate = normalized.ResolvedEffectiveDate == default
                            ? null
                            : normalized.ResolvedEffectiveDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        MatchedEmployeeId = normalized.MatchedEmployeeId,
                        ChangedFacts = normalized.ChangedFacts
                    }
                    : row with
                    {
                        Classification = errorRowNumbers.Contains(row.RowNumber)
                            ? EmployeeImportRowClassification.Invalid
                            : row.Classification
                    })
                .ToList();
        }

        var canValidate =
            session.Stage is EmployeeImportStage.PreviewReady or EmployeeImportStage.Validated;
        var canApply =
            session.Stage == EmployeeImportStage.Validated &&
            validationSummary.ErrorCount == 0;

        return new EmployeeImportSessionDto(
            session.Id,
            session.Stage,
            session.Version,
            session.BatchEffectiveDate,
            session.ImportMode,
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
            lastApplyOperation,
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

    private static List<StoredNormalizedRow> ReadNormalizedRowsSafe(EmployeeImportSession session)
        => string.IsNullOrWhiteSpace(session.NormalizedRowsJson)
            ? []
            : Deserialize<List<StoredNormalizedRow>>(session.NormalizedRowsJson) ?? [];

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

    private static EmployeeImportApplyOperationDto BuildApplyOperationDto(
        EmployeeImportApplyOperation operation)
        => new(
            operation.Id,
            operation.SessionId,
            operation.Status,
            operation.ActorUserId,
            operation.ActorFullName,
            operation.ActorRole,
            operation.QueuedAt,
            operation.StartedAt,
            operation.CompletedAt,
            operation.FailedAt,
            operation.FailureReason,
            operation.HistoryId,
            operation.SourceRowCount,
            operation.ValidatedRowCount,
            operation.ProcessedRowCount,
            operation.CreatedCount,
            operation.PublishedRowCount);

    private static EmployeeImportHistoryListItemDto BuildHistoryListItemDto(EmployeeImportHistory history)
        => new(
            history.Id,
            history.SessionId,
            history.SourceFileName,
            history.SourceFileSizeBytes,
            history.SourceRowCount,
            history.ValidatedRowCount,
            history.CreatedCount,
            history.UnchangedRowCount,
            history.PublishedRowCount,
            history.Status,
            history.AppliedAt,
            history.ActorUserId,
            history.ActorFullName,
            history.ActorRole,
            history.EventType,
            history.ErrorCount,
            history.WarningCount);

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
            history.ValidatedRowCount,
            history.CreatedCount,
            history.UnchangedRowCount,
            history.PublishedRowCount,
            history.Status,
            history.AppliedAt,
            history.ActorUserId,
            history.ActorFullName,
            history.ActorRole,
            history.FailureReason,
            history.EventType,
            history.ErrorCount,
            history.WarningCount)
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
        var followUpIssues = new List<EmployeeImportFollowUpIssue>();

        foreach (var (email, employee) in employeesByEmail)
        {
            var row = normalizedRowsByEmail[email];

            // Check required identity fields
            if (IsFieldRequired(settings, "firstName") && string.IsNullOrWhiteSpace(row.FirstName))
                followUpIssues.Add(MakeIssue(historyId, employee.Id, row.RowNumber, EmployeeReadinessIssueCodes.MissingRequiredField, "firstName"));
            if (IsFieldRequired(settings, "lastName") && string.IsNullOrWhiteSpace(row.LastName))
                followUpIssues.Add(MakeIssue(historyId, employee.Id, row.RowNumber, EmployeeReadinessIssueCodes.MissingRequiredField, "lastName"));
            if (IsFieldRequired(settings, "email") && string.IsNullOrWhiteSpace(row.Email))
                followUpIssues.Add(MakeIssue(historyId, employee.Id, row.RowNumber, EmployeeReadinessIssueCodes.MissingRequiredField, "email"));
            if (IsFieldRequired(settings, "phone") && string.IsNullOrWhiteSpace(row.Phone))
                followUpIssues.Add(MakeIssue(historyId, employee.Id, row.RowNumber, EmployeeReadinessIssueCodes.MissingRequiredField, "phone"));
            if (IsFieldRequired(settings, "jobTitle") && string.IsNullOrWhiteSpace(row.JobTitle))
                followUpIssues.Add(MakeIssue(historyId, employee.Id, row.RowNumber, EmployeeReadinessIssueCodes.MissingRequiredField, "jobTitle"));
            if (IsFieldRequired(settings, "workLocation") && string.IsNullOrWhiteSpace(row.WorkLocation))
                followUpIssues.Add(MakeIssue(historyId, employee.Id, row.RowNumber, EmployeeReadinessIssueCodes.MissingRequiredField, "workLocation"));
            if (IsFieldRequired(settings, "employmentType") && string.IsNullOrWhiteSpace(row.EmploymentType))
                followUpIssues.Add(MakeIssue(historyId, employee.Id, row.RowNumber, EmployeeReadinessIssueCodes.MissingRequiredField, "employmentType"));

            // Org unit: resolved from import row
            if (!row.OrgUnitId.HasValue)
                followUpIssues.Add(MakeIssue(historyId, employee.Id, row.RowNumber, EmployeeReadinessIssueCodes.MissingOrgUnit, "orgUnitId"));

            // Manager: resolved from import row (same-batch managers are pre-resolved during ValidateAsync)
            if (!row.ExistingManagerId.HasValue)
                followUpIssues.Add(MakeIssue(historyId, employee.Id, row.RowNumber, EmployeeReadinessIssueCodes.NoManagerAssigned, "managerId"));
        }

        return followUpIssues;
    }

    private static bool IsFieldRequired(TenantSettingsDto settings, string fieldKey)
        => settings.EmployeeFieldConfig.TryGetValue(fieldKey, out var config) && config.Required;

    private EmployeeImportFollowUpIssue MakeIssue(Guid historyId, Guid employeeId, int rowNumber, string code, string? fieldKey)
        => EmployeeImportFollowUpIssue.Create(tenantContext.TenantId, historyId, employeeId, rowNumber, code, fieldKey);

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

        if (storedIssues.Count == 0) return [];

        var employeeIds = storedIssues.Select(issue => issue.EmployeeId).Distinct().ToList();

        var employees = await dbContext.Employees
            .AsNoTracking()
            .Where(e => employeeIds.Contains(e.Id))
            .ToListAsync(cancellationToken);

        if (employees.Count == 0) return [];

        var now = DateTime.UtcNow;

        // Canonical WorkAssignment: has org unit?
        var employeeIdsWithOrgUnit = (await dbContext.WorkAssignments
            .AsNoTracking()
            .Where(wa => employeeIds.Contains(wa.EmployeeId)
                && wa.IsPrimary
                && wa.EffectiveFrom <= now && (wa.EffectiveTo == null || now < wa.EffectiveTo))
            .Select(wa => wa.EmployeeId)
            .Distinct()
            .ToListAsync(cancellationToken))
            .ToHashSet();

        // Canonical ManagerRelationship: has manager?
        var managerLinks = await dbContext.ManagerRelationships
            .AsNoTracking()
            .Where(m => employeeIds.Contains(m.SubjectEmployeeId)
                && m.Type == Domain.Enums.ReportingRelationshipType.PrimaryManager
                && m.EffectiveFrom <= now && (m.EffectiveTo == null || now < m.EffectiveTo))
            .Select(m => new { m.SubjectEmployeeId, m.ManagerEmployeeId })
            .ToListAsync(cancellationToken);
        var managerIdByEmployee = managerLinks
            .GroupBy(m => m.SubjectEmployeeId)
            .ToDictionary(g => g.Key, g => g.First().ManagerEmployeeId);

        // Manager active status
        var managerIds = managerIdByEmployee.Values.Distinct().ToList();
        HashSet<Guid> activeManagerIds = [];
        if (managerIds.Count > 0)
        {
            activeManagerIds = (await dbContext.Employments
                .AsNoTracking()
                .Where(e => managerIds.Contains(e.EmployeeId)
                    && e.EffectiveFrom <= now && (e.EffectiveTo == null || now < e.EffectiveTo))
                .Select(e => e.EmployeeId)
                .Distinct()
                .ToListAsync(cancellationToken))
                .ToHashSet();
        }

        var employeesById = employees.ToDictionary(e => e.Id);
        var unresolvedIssues = new List<EmployeeImportFollowUpIssueDto>();

        foreach (var storedIssue in storedIssues)
        {
            if (!employeesById.TryGetValue(storedIssue.EmployeeId, out var employee)) continue;

            var isResolved = storedIssue.IssueCode switch
            {
                EmployeeReadinessIssueCodes.MissingOrgUnit => employeeIdsWithOrgUnit.Contains(storedIssue.EmployeeId),
                EmployeeReadinessIssueCodes.NoManagerAssigned => managerIdByEmployee.ContainsKey(storedIssue.EmployeeId),
                EmployeeReadinessIssueCodes.ManagerInactive => managerIdByEmployee.TryGetValue(storedIssue.EmployeeId, out var mgr) && activeManagerIds.Contains(mgr),
                EmployeeReadinessIssueCodes.ManagerMissing => managerIdByEmployee.ContainsKey(storedIssue.EmployeeId),
                _ => false,
            };

            if (isResolved) continue;

            var (label, fixTargetKind) = storedIssue.IssueCode switch
            {
                EmployeeReadinessIssueCodes.MissingOrgUnit => ("Org unit is missing", EmployeeReadinessFixTargetKinds.ProfileOrganization),
                EmployeeReadinessIssueCodes.NoManagerAssigned => ("Manager is missing", EmployeeReadinessFixTargetKinds.ReportingRelationships),
                EmployeeReadinessIssueCodes.ManagerInactive => ("Assigned manager is inactive", EmployeeReadinessFixTargetKinds.ReportingRelationships),
                EmployeeReadinessIssueCodes.ManagerMissing => ("Manager record is missing", EmployeeReadinessFixTargetKinds.ReportingRelationships),
                _ => ("Required field is missing", EmployeeReadinessFixTargetKinds.ProfileIdentity),
            };

            unresolvedIssues.Add(new EmployeeImportFollowUpIssueDto(
                storedIssue.Id,
                storedIssue.SourceRowNumber,
                employee.Id,
                employee.FullName,
                employee.Email,
                storedIssue.IssueCode,
                label,
                storedIssue.FieldKey,
                new EmployeeReadinessFixTargetDto(fixTargetKind, employee.Id, employee.StableEmployeeKey, FieldKey: storedIssue.FieldKey)));
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
            "effectiveDateBeforeHireDate" or "effectiveDateBeforeEmploymentStart" or "noActiveEmploymentAtEffectiveDate" or "invalidEffectiveDate"
                => "invalidEffectiveDateWindow",
            "createInCorrectionBatch" or "managerCorrectionUnsupported"
                => "importModeViolation",
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
            "invalidEffectiveDate" => "Use YYYY-MM-DD format for the effective date.",
            "effectiveDateBeforeHireDate" => "Use an effective date on or after the hire date for new employees.",
            "effectiveDateBeforeEmploymentStart" => "Use an effective date on or after the employee's employment start date.",
            "noActiveEmploymentAtEffectiveDate" => "Use the rehire action to start a new employment period before applying changes via import.",
            "createInCorrectionBatch" => "Correction batches cannot create new employees. Use a business-change import for new hires.",
            "managerCorrectionUnsupported" => "Manager corrections are not supported in a correction batch. Use the change-manager action.",
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

    private static bool HeaderPresent(IReadOnlyList<string> sourceHeaders, string fieldKey)
        => sourceHeaders.Select(CleanHeader).Contains(fieldKey, StringComparer.Ordinal);

    /// <summary>Trim-insensitive, null/empty-equivalent comparison used for change detection.</summary>
    private static bool ValuesEqual(string? left, string? right)
        => string.Equals(
            string.IsNullOrWhiteSpace(left) ? null : left.Trim(),
            string.IsNullOrWhiteSpace(right) ? null : right.Trim(),
            StringComparison.Ordinal);

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
        public DateTime? RowEffectiveDate { get; set; }
        public DateTime ResolvedEffectiveDate { get; set; }
        public Guid? MatchedEmployeeId { get; set; }
        public ExistingEmployeeMatch? MatchedEmployee { get; set; }
        public EmployeeImportRowClassification Classification { get; set; } = EmployeeImportRowClassification.Create;
        public bool ProfileChanged { get; set; }
        public bool EmploymentChanged { get; set; }
        public bool WorkAssignmentChanged { get; set; }
        public bool ManagerChanged { get; set; }
    }

    private sealed record ExistingEmployeeMatch(
        string EmployeeNumber,
        Guid Id,
        string Email,
        string FirstName,
        string LastName,
        string? Phone);

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
        Guid? ExistingManagerId,
        EmployeeImportRowClassification Classification = EmployeeImportRowClassification.Create,
        DateTime ResolvedEffectiveDate = default,
        Guid? MatchedEmployeeId = null,
        bool ProfileChanged = false,
        bool EmploymentChanged = false,
        bool WorkAssignmentChanged = false,
        bool ManagerChanged = false)
    {
        public IReadOnlyList<string> ChangedFacts
        {
            get
            {
                var facts = new List<string>(4);
                if (ProfileChanged) facts.Add("profile");
                if (EmploymentChanged) facts.Add("employment");
                if (WorkAssignmentChanged) facts.Add("workAssignment");
                if (ManagerChanged) facts.Add("manager");
                return facts;
            }
        }
    }

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

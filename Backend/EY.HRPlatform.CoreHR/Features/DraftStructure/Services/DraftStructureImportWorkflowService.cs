using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.DraftStructure.Import.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Services;

public interface IDraftStructureImportWorkflowService
{
    Task<DraftStructureImportSchemaDto> GetSchemaAsync(CancellationToken cancellationToken);
    Task<(byte[] Content, string FileName)> BuildTemplateAsync(CancellationToken cancellationToken);
    Task<DraftStructureImportSessionDto> UploadAsync(IFormFile file, CancellationToken cancellationToken);
    Task<DraftStructureImportSessionDto> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken);
    Task<DraftStructureImportSessionDto> SaveMappingAsync(
        Guid sessionId,
        DraftStructureImportMappingRequest request,
        CancellationToken cancellationToken);
    Task<DraftStructureImportSessionDto> ResolveKindsAsync(
        Guid sessionId,
        DraftStructureImportResolveKindsRequest request,
        CancellationToken cancellationToken);
    Task<DraftStructureImportSessionDto> ValidateAsync(Guid sessionId, CancellationToken cancellationToken);
    Task<DraftStructureImportApplyResultDto> ApplyAsync(Guid sessionId, CancellationToken cancellationToken);
}

public sealed class DraftStructureImportWorkflowService(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext) : IDraftStructureImportWorkflowService
{
    private const int MaxRowCount = 5000;
    private const int SampleRowCount = 12;
    private const int PreviewRowCount = 25;
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(2);

    public async Task<DraftStructureImportSchemaDto> GetSchemaAsync(CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);
        var schema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        return BuildImportSchema(schema);
    }

    public async Task<(byte[] Content, string FileName)> BuildTemplateAsync(CancellationToken cancellationToken)
    {
        var importSchema = await GetSchemaAsync(cancellationToken);
        var output = new StringWriter(CultureInfo.InvariantCulture);
        await using var csv = new CsvWriter(output, CultureInfo.InvariantCulture);

        foreach (var field in importSchema.CanonicalFields)
        {
            csv.WriteField(field.DisplayLabel);
        }

        await csv.NextRecordAsync();
        await csv.FlushAsync();

        return (Encoding.UTF8.GetBytes(output.ToString()), "draft-structure-template.csv");
    }

    public async Task<DraftStructureImportSessionDto> UploadAsync(IFormFile file, CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);

        if (file.Length <= 0)
            throw new ArgumentException("Upload a non-empty CSV file.", nameof(file));

        var fileName = file.FileName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(fileName) || !fileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Only CSV uploads are supported.", nameof(file));

        var parsedFile = await ParseCsvAsync(file, cancellationToken);
        var schema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        var importSchema = BuildImportSchema(schema);
        EnsureTemplateHeaders(parsedFile.Headers, importSchema);
        var columnMappings = CreateTemplateMappings(importSchema);
        var kindResolutions = BuildKindResolutions(parsedFile.Rows, columnMappings, schema, []);
        var session = DraftStructureImportSession.CreateUploaded(
            tenantContext.TenantId,
            fileName,
            file.Length,
            DraftStructureJsonSerializer.SerializeObject(parsedFile.Headers),
            DraftStructureJsonSerializer.SerializeObject(parsedFile.Rows),
            ComputeSchemaFingerprint(schema),
            await ComputeDraftWatermarkAsync(cancellationToken),
            DateTime.UtcNow.Add(SessionLifetime));

        session.SetMapping(
            DraftStructureJsonSerializer.SerializeObject(columnMappings),
            kindResolutions.Count == 0 ? null : DraftStructureJsonSerializer.SerializeObject(kindResolutions),
            kindResolutions.All(IsResolved));

        dbContext.DraftStructureImportSessions.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);

        return await BuildSessionDtoAsync(session, schema, cancellationToken);
    }

    public async Task<DraftStructureImportSessionDto> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);

        var session = await GetSessionEntityAsync(sessionId, cancellationToken);
        var schema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        await MarkExpiredIfNeededAsync(session, cancellationToken);

        return await BuildSessionDtoAsync(session, schema, cancellationToken);
    }

    public async Task<DraftStructureImportSessionDto> SaveMappingAsync(
        Guid sessionId,
        DraftStructureImportMappingRequest request,
        CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);

        var session = await GetSessionEntityAsync(sessionId, cancellationToken);
        await EnsureSessionCanMutateAsync(session, cancellationToken);

        var persistedSchema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        var sourceHeaders = ReadSourceHeaders(session);
        var columnMappings = SanitizeMappings(request.ColumnMappings, sourceHeaders, persistedSchema);
        var sourceRows = ReadSourceRows(session);
        var kindResolutions = BuildKindResolutions(sourceRows, columnMappings, persistedSchema, []);

        session.SetMapping(
            DraftStructureJsonSerializer.SerializeObject(columnMappings),
            kindResolutions.Count == 0 ? null : DraftStructureJsonSerializer.SerializeObject(kindResolutions),
            kindResolutions.All(IsResolved));

        await dbContext.SaveChangesAsync(cancellationToken);

        return await BuildSessionDtoAsync(session, persistedSchema, cancellationToken);
    }

    public async Task<DraftStructureImportSessionDto> ResolveKindsAsync(
        Guid sessionId,
        DraftStructureImportResolveKindsRequest request,
        CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);

        var session = await GetSessionEntityAsync(sessionId, cancellationToken);
        await EnsureSessionCanMutateAsync(session, cancellationToken);

        var columnMappings = ReadColumnMappings(session);
        if (!columnMappings.ContainsKey(CanonicalFieldKeys.OrgUnitKindKey))
            throw new ArgumentException("Map the Unit Type column before resolving unit types.");

        var persistedSchema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        var sourceRows = ReadSourceRows(session);
        var kindResolutions = BuildKindResolutions(sourceRows, columnMappings, persistedSchema, request.KindResolutions);

        session.SetKindReconciliations(
            DraftStructureJsonSerializer.SerializeObject(kindResolutions),
            kindResolutions.All(IsResolved));

        await dbContext.SaveChangesAsync(cancellationToken);

        return await BuildSessionDtoAsync(session, persistedSchema, cancellationToken);
    }

    public async Task<DraftStructureImportSessionDto> ValidateAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);

        var session = await GetSessionEntityAsync(sessionId, cancellationToken);
        await EnsureSessionCanMutateAsync(session, cancellationToken);

        var persistedSchema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        var columnMappings = ReadColumnMappings(session);
        EnsureRequiredMappings(columnMappings);

        var sourceRows = ReadSourceRows(session);
        var kindResolutions = ReadKindResolutions(session);
        if (kindResolutions.Any() && kindResolutions.Any(resolution => !resolution.IsResolved))
            throw new ArgumentException("Resolve all unit types before validating.");

        var effectiveSchema = BuildEffectiveSchema(persistedSchema, kindResolutions);
        var validation = ValidateRows(sourceRows, columnMappings, effectiveSchema, kindResolutions);

        session.SetValidationResult(
            DraftStructureJsonSerializer.SerializeObject(validation.Rows),
            DraftStructureJsonSerializer.SerializeObject(validation.Issues),
            ComputeSchemaFingerprint(persistedSchema),
            await ComputeDraftWatermarkAsync(cancellationToken));

        await dbContext.SaveChangesAsync(cancellationToken);

        return await BuildSessionDtoAsync(session, persistedSchema, cancellationToken);
    }

    public async Task<DraftStructureImportApplyResultDto> ApplyAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        await DraftStructureRules.EnsureSetupActivatedAsync(dbContext, cancellationToken);

        var session = await GetSessionEntityAsync(sessionId, cancellationToken);
        await EnsureSessionCanMutateAsync(session, cancellationToken);

        if (session.Stage != DraftStructureImportStage.Validated)
            throw new ArgumentException("Validate the import before applying it.");

        var validationIssues = ReadValidationIssues(session);
        if (validationIssues.Any(issue => issue.Severity.Equals("error", StringComparison.OrdinalIgnoreCase)))
            throw new ArgumentException("The import contains validation errors. Fix them before applying.");

        var persistedSchema = await DraftStructureRules.GetDraftStructureSchemaAsync(dbContext, cancellationToken);
        var currentSchemaFingerprint = ComputeSchemaFingerprint(persistedSchema);
        var currentDraftWatermark = await ComputeDraftWatermarkAsync(cancellationToken);

        if (!session.SchemaFingerprint.Equals(currentSchemaFingerprint, StringComparison.Ordinal)
            || !session.DraftWatermark.Equals(currentDraftWatermark, StringComparison.Ordinal))
        {
            throw new ConcurrencyException(nameof(DraftStructureImportSession), session.Id);
        }

        var kindResolutions = ReadKindResolutions(session);
        var effectiveSchema = BuildEffectiveSchema(persistedSchema, kindResolutions);
        var normalizedRows = ReadNormalizedRows(session);

        var useTransaction = !string.Equals(
            dbContext.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.OrdinalIgnoreCase);
        await using var transaction = useTransaction
            ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
            : null;

        await UpsertDraftStructureSchemaAsync(effectiveSchema, cancellationToken);
        await ReplaceDraftStructureAsync(normalizedRows, cancellationToken);

        session.MarkApplied();
        await dbContext.SaveChangesAsync(cancellationToken);

        if (transaction is not null)
            await transaction.CommitAsync(cancellationToken);

        return new DraftStructureImportApplyResultDto(
            session.Id,
            normalizedRows.Count,
            effectiveSchema,
            session.AppliedAt ?? DateTime.UtcNow);
    }

    private async Task<DraftStructureImportSession> GetSessionEntityAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await dbContext.DraftStructureImportSessions
            .FirstOrDefaultAsync(candidate => candidate.Id == sessionId, cancellationToken);

        if (session is null)
            throw new EntityNotFoundException(nameof(DraftStructureImportSession), sessionId);

        return session;
    }

    private async Task EnsureSessionCanMutateAsync(
        DraftStructureImportSession session,
        CancellationToken cancellationToken)
    {
        await MarkExpiredIfNeededAsync(session, cancellationToken);

        if (session.Stage == DraftStructureImportStage.Expired)
            throw new ArgumentException("The import session has expired. Upload the file again.");

        if (session.Stage == DraftStructureImportStage.Applied)
            throw new ArgumentException("The import session has already been applied.");
    }

    private async Task MarkExpiredIfNeededAsync(
        DraftStructureImportSession session,
        CancellationToken cancellationToken)
    {
        if (session.Stage == DraftStructureImportStage.Applied || session.Stage == DraftStructureImportStage.Expired)
            return;

        if (session.ExpiresAt >= DateTime.UtcNow)
            return;

        session.MarkExpired();
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task<ParsedCsvFile> ParseCsvAsync(IFormFile file, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: false);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            TrimOptions = TrimOptions.Trim,
            IgnoreBlankLines = true,
            HeaderValidated = null,
            MissingFieldFound = null,
            BadDataFound = null,
            DetectDelimiter = true
        });

        if (!await csv.ReadAsync())
            throw new ArgumentException("The uploaded CSV is empty.");

        csv.ReadHeader();
        var rawHeaders = csv.HeaderRecord?.ToList() ?? [];
        if (rawHeaders.Count == 0)
            throw new ArgumentException("The uploaded CSV must contain a header row.");

        var headers = rawHeaders
            .Select(header => header?.Trim() ?? string.Empty)
            .ToList();

        if (headers.Any(string.IsNullOrWhiteSpace))
            throw new ArgumentException("CSV headers cannot be blank.");

        var duplicateHeader = headers
            .GroupBy(header => header, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group => group.Count() > 1);

        if (duplicateHeader is not null)
            throw new ArgumentException($"Duplicate CSV header '{duplicateHeader.Key}' detected.");

        var rows = new List<StoredSourceRow>();
        var rowNumber = 1;

        while (await csv.ReadAsync())
        {
            cancellationToken.ThrowIfCancellationRequested();
            rowNumber += 1;

            var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            foreach (var header in headers)
            {
                values[header] = csv.GetField(header)?.Trim();
            }

            var isBlankRow = values.Values.All(value => string.IsNullOrWhiteSpace(value));
            if (isBlankRow)
                continue;

            rows.Add(new StoredSourceRow(rowNumber, values));
            if (rows.Count > MaxRowCount)
                throw new ArgumentException($"CSV imports are limited to {MaxRowCount} data rows.");
        }

        if (rows.Count == 0)
            throw new ArgumentException("The uploaded CSV must contain at least one data row.");

        return new ParsedCsvFile(headers, rows);
    }

    private static DraftStructureImportSchemaDto BuildImportSchema(DraftStructureSchemaDto schema)
    {
        var canonicalFields = new List<DraftStructureImportCanonicalFieldDto>
        {
            new(CanonicalFieldKeys.ReferenceKey, "Unit Code", true, "text"),
            new(CanonicalFieldKeys.DisplayName, "Unit Name", true, "text"),
            new(
                CanonicalFieldKeys.OrgUnitKindKey,
                "Unit Type",
                true,
                "orgUnitKind",
                schema.OrgUnitKinds.Select(kind => kind.DisplayLabel).ToList()),
            new(CanonicalFieldKeys.ParentReferenceKey, "Parent Unit Code", false, "text"),
            new(CanonicalFieldKeys.Location, "Location", false, "text"),
            new(CanonicalFieldKeys.Description, "Description", false, "text")
        };

        canonicalFields.AddRange(schema.Attributes
            .OrderBy(attribute => attribute.DisplayLabel)
            .Select(attribute => new DraftStructureImportCanonicalFieldDto(
                $"attributes.{attribute.Key}",
                attribute.DisplayLabel,
                attribute.Required,
                attribute.ValueType,
                attribute.AllowedValues,
                attribute.AppliesToKindKeys)));

        return new DraftStructureImportSchemaDto(schema, canonicalFields);
    }

    private static Dictionary<string, string> SanitizeMappings(
        Dictionary<string, string>? requestedMappings,
        IReadOnlyCollection<string> sourceHeaders,
        DraftStructureSchemaDto schema)
    {
        if (requestedMappings is null || requestedMappings.Count == 0)
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var importSchema = BuildImportSchema(schema);
        var validTargets = importSchema.CanonicalFields
            .Select(field => field.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var headersByName = sourceHeaders.ToDictionary(header => header, StringComparer.OrdinalIgnoreCase);
        var sanitized = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var (target, sourceHeader) in requestedMappings)
        {
            if (string.IsNullOrWhiteSpace(target) || string.IsNullOrWhiteSpace(sourceHeader))
                continue;

            var trimmedTarget = target.Trim();
            var trimmedSourceHeader = sourceHeader.Trim();

            if (!validTargets.Contains(trimmedTarget))
                throw new ArgumentException($"Unknown canonical field '{trimmedTarget}'.");

            if (!headersByName.TryGetValue(trimmedSourceHeader, out var actualHeader))
                throw new ArgumentException($"CSV header '{trimmedSourceHeader}' does not exist in the uploaded file.");

            sanitized[trimmedTarget] = actualHeader;
        }

        return sanitized;
    }

    private static void EnsureRequiredMappings(Dictionary<string, string> columnMappings)
    {
        var missingTargets = new[]
            {
                CanonicalFieldKeys.ReferenceKey,
                CanonicalFieldKeys.DisplayName,
                CanonicalFieldKeys.OrgUnitKindKey
            }
            .Where(requiredTarget => !columnMappings.ContainsKey(requiredTarget))
            .ToList();

        if (missingTargets.Count > 0)
        {
            throw new ArgumentException($"Map required fields before validating: {string.Join(", ", missingTargets)}.");
        }
    }

    private static void EnsureTemplateHeaders(
        IReadOnlyList<string> sourceHeaders,
        DraftStructureImportSchemaDto importSchema)
    {
        var expectedHeaders = importSchema.CanonicalFields
            .Select(field => field.DisplayLabel)
            .ToList();

        var matchesTemplate = sourceHeaders.Count == expectedHeaders.Count
            && sourceHeaders.SequenceEqual(expectedHeaders, StringComparer.OrdinalIgnoreCase);

        if (matchesTemplate)
            return;

        var missingHeaders = expectedHeaders
            .Where(expectedHeader => !sourceHeaders.Contains(expectedHeader, StringComparer.OrdinalIgnoreCase))
            .ToList();
        var unexpectedHeaders = sourceHeaders
            .Where(sourceHeader => !expectedHeaders.Contains(sourceHeader, StringComparer.OrdinalIgnoreCase))
            .ToList();
        var hasSameHeaderSet = missingHeaders.Count == 0 && unexpectedHeaders.Count == 0;
        var messageParts = new List<string>
        {
            "This import only accepts the official draft-structure template."
        };

        if (missingHeaders.Count > 0)
        {
            messageParts.Add($"Missing columns: {string.Join(", ", missingHeaders)}.");
        }

        if (unexpectedHeaders.Count > 0)
        {
            messageParts.Add($"Unexpected columns: {string.Join(", ", unexpectedHeaders)}.");
        }

        if (hasSameHeaderSet)
        {
            messageParts.Add("Use the downloaded template without renaming or reordering the headers.");
        }

        messageParts.Add($"Expected headers: {string.Join(", ", expectedHeaders)}.");
        throw new ArgumentException(string.Join(" ", messageParts));
    }

    private static Dictionary<string, string> CreateTemplateMappings(
        DraftStructureImportSchemaDto importSchema)
    {
        return importSchema.CanonicalFields.ToDictionary(
            field => field.Key,
            field => field.DisplayLabel,
            StringComparer.OrdinalIgnoreCase);
    }

    private static List<StoredKindResolution> BuildKindResolutions(
        IReadOnlyCollection<StoredSourceRow> sourceRows,
        Dictionary<string, string> columnMappings,
        DraftStructureSchemaDto persistedSchema,
        IReadOnlyCollection<DraftStructureImportResolveKindInputDto> requestedOverrides)
    {
        if (!columnMappings.TryGetValue(CanonicalFieldKeys.OrgUnitKindKey, out var orgUnitKindHeader))
            return [];

        var distinctSourceValues = sourceRows
            .Select(row => ReadMappedValue(row, orgUnitKindHeader))
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var resolutions = distinctSourceValues.ToDictionary(
            sourceValue => sourceValue,
            sourceValue => CreateAutomaticKindResolution(sourceValue, persistedSchema),
            StringComparer.OrdinalIgnoreCase);

        foreach (var requestedOverride in requestedOverrides)
        {
            if (string.IsNullOrWhiteSpace(requestedOverride.SourceValue))
                throw new ArgumentException("Each kind reconciliation must include a source value.");

            var sourceValue = requestedOverride.SourceValue.Trim();
            if (!resolutions.ContainsKey(sourceValue))
                throw new ArgumentException($"Source kind '{sourceValue}' does not exist in this import session.");

            resolutions[sourceValue] = CreateRequestedKindResolution(sourceValue, requestedOverride, persistedSchema);
        }

        return resolutions.Values
            .OrderBy(resolution => resolution.SourceValue, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static StoredKindResolution CreateAutomaticKindResolution(
        string sourceValue,
        DraftStructureSchemaDto persistedSchema)
    {
        var normalizedCandidateKey = DraftStructureRules.NormalizeKindKey(sourceValue);
        var matchedKind = persistedSchema.OrgUnitKinds.FirstOrDefault(kind =>
            kind.Key.Equals(normalizedCandidateKey, StringComparison.OrdinalIgnoreCase)
            || kind.DisplayLabel.Equals(sourceValue, StringComparison.OrdinalIgnoreCase));

        if (matchedKind is not null)
        {
            return new StoredKindResolution(
                sourceValue,
                matchedKind.Key,
                matchedKind.DisplayLabel,
                false,
                matchedKind.Key,
                true);
        }

        return new StoredKindResolution(
            sourceValue,
            normalizedCandidateKey,
            sourceValue.Trim(),
            true,
            normalizedCandidateKey,
            true);
    }

    private static StoredKindResolution CreateRequestedKindResolution(
        string sourceValue,
        DraftStructureImportResolveKindInputDto requestedOverride,
        DraftStructureSchemaDto persistedSchema)
    {
        if (requestedOverride.CreateNewKind)
        {
            var displayLabel = string.IsNullOrWhiteSpace(requestedOverride.DisplayLabel)
                ? sourceValue
                : requestedOverride.DisplayLabel.Trim();
            var keySeed = string.IsNullOrWhiteSpace(requestedOverride.OrgUnitKindKey)
                ? displayLabel
                : requestedOverride.OrgUnitKindKey;
            var normalizedKindKey = DraftStructureRules.NormalizeKindKey(keySeed);

            if (string.IsNullOrWhiteSpace(normalizedKindKey))
                throw new ArgumentException($"New org unit kind for source value '{sourceValue}' must include a valid key.");

            if (persistedSchema.OrgUnitKinds.Any(kind => kind.Key.Equals(normalizedKindKey, StringComparison.OrdinalIgnoreCase)))
            {
                throw new ArgumentException(
                    $"Org unit kind key '{normalizedKindKey}' already exists. Select the existing kind instead of creating a new one.");
            }

            return new StoredKindResolution(
                sourceValue,
                normalizedKindKey,
                displayLabel,
                true,
                normalizedKindKey,
                true);
        }

        if (string.IsNullOrWhiteSpace(requestedOverride.OrgUnitKindKey))
            throw new ArgumentException($"Existing kind resolution for source value '{sourceValue}' must include an orgUnitKindKey.");

        var normalizedRequestedKey = DraftStructureRules.NormalizeKindKey(requestedOverride.OrgUnitKindKey);
        var matchedKind = persistedSchema.OrgUnitKinds.FirstOrDefault(kind =>
            kind.Key.Equals(normalizedRequestedKey, StringComparison.OrdinalIgnoreCase)
            || kind.DisplayLabel.Equals(requestedOverride.OrgUnitKindKey, StringComparison.OrdinalIgnoreCase));

        if (matchedKind is null)
            throw new ArgumentException($"Org unit kind '{requestedOverride.OrgUnitKindKey}' does not exist in the current tenant schema.");

        return new StoredKindResolution(
            sourceValue,
            matchedKind.Key,
            matchedKind.DisplayLabel,
            false,
            matchedKind.Key,
            true);
    }

    private static ValidationResult ValidateRows(
        IReadOnlyCollection<StoredSourceRow> sourceRows,
        Dictionary<string, string> columnMappings,
        DraftStructureSchemaDto effectiveSchema,
        IReadOnlyCollection<StoredKindResolution> kindResolutions)
    {
        var issues = new List<StoredValidationIssue>();
        var normalizedRows = new List<StoredNormalizedRow>();
        var resolutionsBySourceValue = kindResolutions.ToDictionary(
            resolution => resolution.SourceValue,
            resolution => resolution,
            StringComparer.OrdinalIgnoreCase);
        var seenReferenceKeys = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var sourceRow in sourceRows)
        {
            var referenceKey = ReadMappedValue(sourceRow, columnMappings, CanonicalFieldKeys.ReferenceKey);
            var displayName = ReadMappedValue(sourceRow, columnMappings, CanonicalFieldKeys.DisplayName);
            var orgUnitKindSourceValue = ReadMappedValue(sourceRow, columnMappings, CanonicalFieldKeys.OrgUnitKindKey);
            var parentReferenceKey = ReadMappedValue(sourceRow, columnMappings, CanonicalFieldKeys.ParentReferenceKey);
            var location = ReadMappedValue(sourceRow, columnMappings, CanonicalFieldKeys.Location);
            var description = ReadMappedValue(sourceRow, columnMappings, CanonicalFieldKeys.Description);

            if (string.IsNullOrWhiteSpace(referenceKey))
                issues.Add(new StoredValidationIssue(sourceRow.RowNumber, CanonicalFieldKeys.ReferenceKey, "error", "missingReferenceKey", "Unit code is required."));

            if (string.IsNullOrWhiteSpace(displayName))
                issues.Add(new StoredValidationIssue(sourceRow.RowNumber, CanonicalFieldKeys.DisplayName, "error", "missingDisplayName", "Unit name is required."));

            if (string.IsNullOrWhiteSpace(orgUnitKindSourceValue))
            {
                issues.Add(new StoredValidationIssue(sourceRow.RowNumber, CanonicalFieldKeys.OrgUnitKindKey, "error", "missingOrgUnitKind", "Unit type is required."));
                continue;
            }

            if (!resolutionsBySourceValue.TryGetValue(orgUnitKindSourceValue.Trim(), out var kindResolution) || !kindResolution.IsResolved)
            {
                issues.Add(new StoredValidationIssue(sourceRow.RowNumber, CanonicalFieldKeys.OrgUnitKindKey, "error", "unresolvedOrgUnitKind", $"Unit type '{orgUnitKindSourceValue}' could not be matched."));
                continue;
            }

            if (string.IsNullOrWhiteSpace(referenceKey) || string.IsNullOrWhiteSpace(displayName))
                continue;

            var attributeValues = ReadAttributeValues(sourceRow, columnMappings);
            string? attributesJson;

            try
            {
                DraftStructureRules.ValidateOrgUnitKind(effectiveSchema, kindResolution.ResolvedOrgUnitKindKey!);
                attributesJson = DraftStructureRules.ValidateAndNormalizeAttributes(
                    effectiveSchema,
                    kindResolution.ResolvedOrgUnitKindKey!,
                    attributeValues.Count == 0 ? null : attributeValues);
            }
            catch (ArgumentException ex)
            {
                issues.Add(new StoredValidationIssue(sourceRow.RowNumber, null, "error", "invalidAttributes", ex.Message));
                continue;
            }

            var trimmedReferenceKey = referenceKey.Trim();
            var normalizedReferenceKey = DraftStructureRules.NormalizeReferenceKey(trimmedReferenceKey);
            if (!seenReferenceKeys.TryAdd(normalizedReferenceKey, sourceRow.RowNumber))
            {
                issues.Add(new StoredValidationIssue(
                    sourceRow.RowNumber,
                    CanonicalFieldKeys.ReferenceKey,
                    "error",
                    "duplicateReferenceKey",
                    $"Unit code '{trimmedReferenceKey}' is duplicated in the upload."));
                continue;
            }

            var normalizedParentReferenceKey = string.IsNullOrWhiteSpace(parentReferenceKey)
                ? null
                : DraftStructureRules.NormalizeReferenceKey(parentReferenceKey);

            normalizedRows.Add(new StoredNormalizedRow(
                sourceRow.RowNumber,
                trimmedReferenceKey,
                normalizedReferenceKey,
                displayName.Trim(),
                kindResolution.ResolvedOrgUnitKindKey!,
                string.IsNullOrWhiteSpace(parentReferenceKey) ? null : parentReferenceKey.Trim(),
                normalizedParentReferenceKey,
                string.IsNullOrWhiteSpace(location) ? null : location.Trim(),
                string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
                attributesJson));
        }

        var rowsByReferenceKey = normalizedRows.ToDictionary(row => row.NormalizedReferenceKey, StringComparer.OrdinalIgnoreCase);
        foreach (var normalizedRow in normalizedRows)
        {
            if (string.IsNullOrWhiteSpace(normalizedRow.NormalizedParentReferenceKey))
                continue;

            if (normalizedRow.NormalizedParentReferenceKey.Equals(normalizedRow.NormalizedReferenceKey, StringComparison.OrdinalIgnoreCase))
            {
                issues.Add(new StoredValidationIssue(
                    normalizedRow.RowNumber,
                    CanonicalFieldKeys.ParentReferenceKey,
                    "error",
                    "selfParent",
                    "A row cannot reference its own unit code as the parent."));
                continue;
            }

            if (!rowsByReferenceKey.ContainsKey(normalizedRow.NormalizedParentReferenceKey))
            {
                issues.Add(new StoredValidationIssue(
                    normalizedRow.RowNumber,
                    CanonicalFieldKeys.ParentReferenceKey,
                    "error",
                    "missingParent",
                    $"Parent unit code '{normalizedRow.ParentReferenceKey}' does not exist in the uploaded file."));
            }
        }

        foreach (var normalizedRow in normalizedRows)
        {
            var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                normalizedRow.NormalizedReferenceKey
            };
            var currentParent = normalizedRow.NormalizedParentReferenceKey;

            while (!string.IsNullOrWhiteSpace(currentParent) && rowsByReferenceKey.TryGetValue(currentParent, out var parentRow))
            {
                if (!visited.Add(currentParent))
                {
                    issues.Add(new StoredValidationIssue(
                        normalizedRow.RowNumber,
                        CanonicalFieldKeys.ParentReferenceKey,
                        "error",
                        "cycle",
                        "The uploaded structure contains a parent cycle."));
                    break;
                }

                currentParent = parentRow.NormalizedParentReferenceKey;
            }
        }

        return new ValidationResult(
            normalizedRows.OrderBy(row => row.RowNumber).ToList(),
            issues.OrderBy(issue => issue.RowNumber).ThenBy(issue => issue.Field).ToList());
    }

    private async Task<DraftStructureImportSessionDto> BuildSessionDtoAsync(
        DraftStructureImportSession session,
        DraftStructureSchemaDto persistedSchema,
        CancellationToken cancellationToken)
    {
        await Task.CompletedTask;

        var sourceHeaders = ReadSourceHeaders(session);
        var sourceRows = ReadSourceRows(session);
        var columnMappings = ReadColumnMappings(session);
        var kindResolutions = ReadKindResolutions(session);
        var effectiveSchema = BuildEffectiveSchema(persistedSchema, kindResolutions);
        var importSchema = BuildImportSchema(effectiveSchema);
        var validationIssues = ReadValidationIssues(session)
            .Select(issue => new DraftStructureImportValidationIssueDto(
                issue.RowNumber,
                issue.Field,
                issue.Severity,
                issue.Code,
                issue.Message))
            .ToList();
        var normalizedRows = ReadNormalizedRows(session);
        var validationSummary = BuildValidationSummary(sourceRows.Count, validationIssues);
        var kindLabels = effectiveSchema.OrgUnitKinds.ToDictionary(kind => kind.Key, kind => kind.DisplayLabel, StringComparer.OrdinalIgnoreCase);

        return new DraftStructureImportSessionDto(
            session.Id,
            session.Stage,
            session.Version,
            session.SourceFileName,
            session.SourceFileSizeBytes,
            sourceRows.Count,
            sourceHeaders.ToList(),
            sourceRows
                .Take(SampleRowCount)
                .Select(row => new DraftStructureImportSourceRowDto(row.RowNumber, new Dictionary<string, string?>(row.Values, StringComparer.OrdinalIgnoreCase)))
                .ToList(),
            importSchema,
            new Dictionary<string, string>(columnMappings, StringComparer.OrdinalIgnoreCase),
            kindResolutions
                .Select(resolution => new DraftStructureImportKindResolutionDto(
                    resolution.SourceValue,
                    resolution.ResolvedOrgUnitKindKey,
                    resolution.ResolvedDisplayLabel,
                    resolution.CreateNewKind,
                    resolution.IsResolved,
                    resolution.SuggestedOrgUnitKindKey))
                .ToList(),
            validationSummary,
            validationIssues,
            normalizedRows
                .Take(PreviewRowCount)
                .Select(row => new DraftStructureImportPreviewRowDto(
                    row.RowNumber,
                    row.ReferenceKey,
                    row.DisplayName,
                    row.OrgUnitKindKey,
                    kindLabels.TryGetValue(row.OrgUnitKindKey, out var orgUnitKindLabel) ? orgUnitKindLabel : row.OrgUnitKindKey,
                    row.ParentReferenceKey,
                    row.Location,
                    row.Description,
                    DraftStructureJsonSerializer.DeserializeAttributes(row.AttributesJson)))
                .ToList(),
            session.ExpiresAt,
            session.Stage != DraftStructureImportStage.Applied
            && session.Stage != DraftStructureImportStage.Expired
            && HasRequiredMappings(columnMappings)
            && kindResolutions.All(IsResolved),
            session.Stage == DraftStructureImportStage.Validated
            && validationSummary.ErrorCount == 0);
    }

    private static DraftStructureImportValidationSummaryDto BuildValidationSummary(
        int totalRows,
        List<DraftStructureImportValidationIssueDto> validationIssues)
    {
        var errorRows = validationIssues
            .Where(issue => issue.Severity.Equals("error", StringComparison.OrdinalIgnoreCase))
            .Select(issue => issue.RowNumber)
            .Distinct()
            .Count();
        var warningCount = validationIssues.Count(issue => issue.Severity.Equals("warning", StringComparison.OrdinalIgnoreCase));
        var errorCount = validationIssues.Count(issue => issue.Severity.Equals("error", StringComparison.OrdinalIgnoreCase));

        return new DraftStructureImportValidationSummaryDto(
            totalRows,
            Math.Max(totalRows - errorRows, 0),
            errorCount,
            warningCount);
    }

    private static bool HasRequiredMappings(Dictionary<string, string> columnMappings)
        => columnMappings.ContainsKey(CanonicalFieldKeys.ReferenceKey)
            && columnMappings.ContainsKey(CanonicalFieldKeys.DisplayName)
            && columnMappings.ContainsKey(CanonicalFieldKeys.OrgUnitKindKey);

    private async Task<string> ComputeDraftWatermarkAsync(CancellationToken cancellationToken)
    {
        var projection = await dbContext.DraftOrgUnits
            .AsNoTracking()
            .OrderBy(unit => unit.NormalizedReferenceKey)
            .Select(unit => new
            {
                unit.NormalizedReferenceKey,
                unit.ParentId,
                unit.OrgUnitKindKey,
                unit.Location,
                unit.Description,
                unit.UpdatedAt,
                unit.Version
            })
            .ToListAsync(cancellationToken);

        return ComputeFingerprint(projection);
    }

    private static string ComputeSchemaFingerprint(DraftStructureSchemaDto schema)
        => ComputeFingerprint(schema);

    private static string ComputeFingerprint<TValue>(TValue value)
    {
        var json = DraftStructureJsonSerializer.SerializeObject(value);
        var bytes = Encoding.UTF8.GetBytes(json);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    private async Task UpsertDraftStructureSchemaAsync(
        DraftStructureSchemaDto effectiveSchema,
        CancellationToken cancellationToken)
    {
        var tenantSettings = await dbContext.TenantSettings.FirstOrDefaultAsync(cancellationToken);
        var overridesJson = TenantSettingsOverrideBuilder.Build(
            tenantSettings?.SettingsOverrides,
            orgUnitTypes: null,
            employeeFieldConfig: null,
            branding: null,
            draftStructureSchema: effectiveSchema);

        if (tenantSettings is null)
        {
            tenantSettings = EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings.Create(
                tenantContext.TenantId,
                overridesJson);
            dbContext.TenantSettings.Add(tenantSettings);
            return;
        }

        tenantSettings.UpdateOverrides(overridesJson);
    }

    private async Task ReplaceDraftStructureAsync(
        IReadOnlyCollection<StoredNormalizedRow> normalizedRows,
        CancellationToken cancellationToken)
    {
        var existingUnits = await dbContext.DraftOrgUnits.ToListAsync(cancellationToken);
        if (existingUnits.Count > 0)
        {
            var existingById = existingUnits.ToDictionary(unit => unit.Id);
            var existingByDepth = existingUnits
                .OrderByDescending(unit => GetDepth(unit, existingById))
                .ToList();

            dbContext.DraftOrgUnits.RemoveRange(existingByDepth);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var entitiesByReferenceKey = new Dictionary<string, DraftOrgUnit>(StringComparer.OrdinalIgnoreCase);
        foreach (var normalizedRow in normalizedRows)
        {
            var entity = DraftOrgUnit.Create(
                tenantContext.TenantId,
                normalizedRow.ReferenceKey,
                normalizedRow.DisplayName,
                normalizedRow.OrgUnitKindKey,
                normalizedRow.Location,
                normalizedRow.Description,
                normalizedRow.AttributesJson,
                parentId: null);

            entitiesByReferenceKey[normalizedRow.NormalizedReferenceKey] = entity;
            dbContext.DraftOrgUnits.Add(entity);
        }

        foreach (var normalizedRow in normalizedRows.Where(row => !string.IsNullOrWhiteSpace(row.NormalizedParentReferenceKey)))
        {
            var child = entitiesByReferenceKey[normalizedRow.NormalizedReferenceKey];
            var parent = entitiesByReferenceKey[normalizedRow.NormalizedParentReferenceKey!];
            child.Reparent(parent.Id);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static int GetDepth(DraftOrgUnit unit, IReadOnlyDictionary<Guid, DraftOrgUnit> unitsById)
    {
        var depth = 0;
        var currentParentId = unit.ParentId;

        while (currentParentId.HasValue && unitsById.TryGetValue(currentParentId.Value, out var parent))
        {
            depth += 1;
            currentParentId = parent.ParentId;
        }

        return depth;
    }

    private static DraftStructureSchemaDto BuildEffectiveSchema(
        DraftStructureSchemaDto persistedSchema,
        IReadOnlyCollection<StoredKindResolution> kindResolutions)
    {
        var orgUnitKinds = persistedSchema.OrgUnitKinds
            .Select(kind => new OrgUnitKindDto(kind.Key, kind.DisplayLabel))
            .ToList();

        foreach (var kindResolution in kindResolutions.Where(resolution => resolution.CreateNewKind && resolution.IsResolved))
        {
            if (orgUnitKinds.Any(kind => kind.Key.Equals(kindResolution.ResolvedOrgUnitKindKey, StringComparison.OrdinalIgnoreCase)))
                continue;

            orgUnitKinds.Add(new OrgUnitKindDto(
                kindResolution.ResolvedOrgUnitKindKey!,
                kindResolution.ResolvedDisplayLabel ?? kindResolution.SourceValue));
        }

        return new DraftStructureSchemaDto
        {
            OrgUnitKinds = orgUnitKinds
                .OrderBy(kind => kind.DisplayLabel, StringComparer.OrdinalIgnoreCase)
                .ToList(),
            Attributes = persistedSchema.Attributes
                .Select(attribute => new DraftStructureAttributeDefinitionDto(
                    attribute.Key,
                    attribute.DisplayLabel,
                    attribute.ValueType,
                    attribute.Required,
                    attribute.AppliesToKindKeys is null ? null : [.. attribute.AppliesToKindKeys],
                    attribute.AllowedValues is null ? null : [.. attribute.AllowedValues]))
                .ToList()
        };
    }

    private static IReadOnlyList<string> ReadSourceHeaders(DraftStructureImportSession session)
        => DraftStructureJsonSerializer.Deserialize(session.SourceHeadersJson, new List<string>());

    private static List<StoredSourceRow> ReadSourceRows(DraftStructureImportSession session)
        => DraftStructureJsonSerializer.Deserialize(session.SourceRowsJson, new List<StoredSourceRow>());

    private static Dictionary<string, string> ReadColumnMappings(DraftStructureImportSession session)
        => DraftStructureJsonSerializer.Deserialize(session.MappingJson, new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase));

    private static List<StoredKindResolution> ReadKindResolutions(DraftStructureImportSession session)
        => DraftStructureJsonSerializer.Deserialize(session.KindReconciliationsJson, new List<StoredKindResolution>());

    private static List<StoredNormalizedRow> ReadNormalizedRows(DraftStructureImportSession session)
        => DraftStructureJsonSerializer.Deserialize(session.NormalizedRowsJson, new List<StoredNormalizedRow>());

    private static List<StoredValidationIssue> ReadValidationIssues(DraftStructureImportSession session)
        => DraftStructureJsonSerializer.Deserialize(session.ValidationIssuesJson, new List<StoredValidationIssue>());

    private static string? ReadMappedValue(
        StoredSourceRow row,
        Dictionary<string, string> columnMappings,
        string canonicalFieldKey)
        => columnMappings.TryGetValue(canonicalFieldKey, out var sourceHeader)
            ? ReadMappedValue(row, sourceHeader)
            : null;

    private static string? ReadMappedValue(StoredSourceRow row, string sourceHeader)
        => row.Values.TryGetValue(sourceHeader, out var value) ? value : null;

    private static Dictionary<string, object?> ReadAttributeValues(
        StoredSourceRow row,
        Dictionary<string, string> columnMappings)
    {
        var attributes = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

        foreach (var (target, sourceHeader) in columnMappings.Where(mapping => mapping.Key.StartsWith("attributes.", StringComparison.OrdinalIgnoreCase)))
        {
            var value = ReadMappedValue(row, sourceHeader);
            if (string.IsNullOrWhiteSpace(value))
                continue;

            var attributeKey = target["attributes.".Length..];
            attributes[attributeKey] = value;
        }

        return attributes;
    }

    private static bool IsResolved(StoredKindResolution kindResolution)
        => kindResolution.IsResolved;

    private static class CanonicalFieldKeys
    {
        public const string ReferenceKey = "referenceKey";
        public const string DisplayName = "displayName";
        public const string OrgUnitKindKey = "orgUnitKindKey";
        public const string ParentReferenceKey = "parentReferenceKey";
        public const string Location = "location";
        public const string Description = "description";
    }

    private sealed record ParsedCsvFile(
        List<string> Headers,
        List<StoredSourceRow> Rows);

    private sealed record StoredSourceRow(
        int RowNumber,
        Dictionary<string, string?> Values);

    private sealed record StoredKindResolution(
        string SourceValue,
        string? ResolvedOrgUnitKindKey,
        string? ResolvedDisplayLabel,
        bool CreateNewKind,
        string SuggestedOrgUnitKindKey,
        bool IsResolved);

    private sealed record StoredNormalizedRow(
        int RowNumber,
        string ReferenceKey,
        string NormalizedReferenceKey,
        string DisplayName,
        string OrgUnitKindKey,
        string? ParentReferenceKey,
        string? NormalizedParentReferenceKey,
        string? Location,
        string? Description,
        string? AttributesJson);

    private sealed record StoredValidationIssue(
        int RowNumber,
        string? Field,
        string Severity,
        string Code,
        string Message);

    private sealed record ValidationResult(
        List<StoredNormalizedRow> Rows,
        List<StoredValidationIssue> Issues);
}
using System.Data;
using System.Data.Common;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace EY.HRPlatform.CoreHR.Features.People;

public sealed class PeopleQueryHandler(
    CoreHRDbContext dbContext,
    ITenantContext tenantContext) : IQueryHandler<PeopleQuery, Result<PeoplePageDto>>
{
    private const int MaxPageSize = 100;

    public async Task<Result<PeoplePageDto>> Handle(PeopleQuery request, CancellationToken cancellationToken)
    {
        if (!dbContext.Database.IsNpgsql())
            return await HandlePortableAsync(request, cancellationToken);

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);
        var offset = (page - 1) * pageSize;
        var orderBy = BuildOrderBy(request.Sort, request.Direction);
        var sql = BuildSql(orderBy);
        var connection = dbContext.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
            await connection.OpenAsync(cancellationToken);

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = sql;
            command.Transaction = dbContext.Database.CurrentTransaction?.GetDbTransaction();
            AddParameter(command, "tenantId", tenantContext.TenantId, DbType.Guid);
            AddParameter(command, "today", DateTime.UtcNow.Date, DbType.DateTime);
            AddParameter(command, "q", string.IsNullOrWhiteSpace(request.Q) ? DBNull.Value : request.Q.Trim().ToLowerInvariant(), DbType.String);
            AddParameter(command, "state", request.State?.ToString() ?? (object)DBNull.Value, DbType.String);
            AddParameter(command, "orgUnitId", request.OrgUnitId ?? (object)DBNull.Value, DbType.Guid);
            AddParameter(command, "orgScope", request.OrganizationScope.ToString());
            AddParameter(command, "offset", offset);
            AddParameter(command, "limit", pageSize);

            var items = new List<PeopleRowDto>(pageSize);
            var total = 0;
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                total = reader.GetInt32(reader.GetOrdinal("TotalCount"));
                var state = Enum.Parse<PeopleEmploymentState>(reader.GetString(reader.GetOrdinal("EmploymentState")));
                var jobTitle = GetNullableString(reader, "JobTitle");
                var work = jobTitle is null
                    ? null
                    : new PeopleWorkDto(
                        jobTitle,
                        GetNullableString(reader, "OrganizationName") ?? "Work details unavailable",
                        GetNullableString(reader, "OrganizationPath") ?? "Work details unavailable",
                        GetNullableString(reader, "WorkLocation"),
                        reader.GetDateTime(reader.GetOrdinal("WorkEffectiveFrom")),
                        state == PeopleEmploymentState.Former);
                var managerKey = GetNullableString(reader, "ManagerEmployeeKey");
                var manager = managerKey is null
                    ? null
                    : new PeopleManagerDto(
                        managerKey,
                        reader.GetString(reader.GetOrdinal("ManagerDisplayName")),
                        reader.GetString(reader.GetOrdinal("ManagerEmployeeNumber")));

                items.Add(new PeopleRowDto(
                    reader.GetString(reader.GetOrdinal("EmployeeKey")),
                    reader.GetString(reader.GetOrdinal("EmployeeNumber")),
                    reader.GetString(reader.GetOrdinal("DisplayName")),
                    reader.GetString(reader.GetOrdinal("FirstName")),
                    reader.GetString(reader.GetOrdinal("LastName")),
                    GetNullableString(reader, "WorkEmail"),
                    state,
                    GetNullableDateTime(reader, "EmploymentStart"),
                    GetNullableDateTime(reader, "EmploymentEnd"),
                    work,
                    manager,
                    work is null ? "WorkDetailsUnavailable" : "Complete"));
            }

            return Result.Success(new PeoplePageDto(
                items,
                total,
                page,
                pageSize,
                total == 0 ? 0 : (int)Math.Ceiling(total / (double)pageSize)));
        }
        finally
        {
            if (shouldClose)
                await connection.CloseAsync();
        }
    }

    private async Task<Result<PeoplePageDto>> HandlePortableAsync(PeopleQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, MaxPageSize);
        var employees = await dbContext.Employees.AsNoTracking()
            .OrderBy(employee => employee.LastName)
            .ThenBy(employee => employee.FirstName)
            .ThenBy(employee => employee.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        var total = await dbContext.Employees.CountAsync(cancellationToken);
        var rows = employees.Select(employee => new PeopleRowDto(
            employee.StableEmployeeKey,
            employee.EmployeeNumber,
            employee.DisplayName,
            employee.FirstName,
            employee.LastName,
            employee.Email,
            PeopleEmploymentState.Incomplete,
            null,
            null,
            null,
            null,
            "WorkDetailsUnavailable")).ToList();
        return Result.Success(new PeoplePageDto(rows, total, page, pageSize, total == 0 ? 0 : (int)Math.Ceiling(total / (double)pageSize)));
    }

    private static string BuildOrderBy(PeopleSortField sort, PeopleSortDirection direction)
    {
        var dir = direction == PeopleSortDirection.Desc ? "DESC" : "ASC";
        return sort switch
        {
            PeopleSortField.EmployeeNumber => $"f.\"EmployeeNumber\" {dir}, f.\"EmployeeId\" ASC",
            PeopleSortField.EmploymentDate => $"f.\"EmploymentStart\" {dir} NULLS LAST, f.\"EmployeeId\" ASC",
            _ => $"f.\"LastName\" {dir}, f.\"FirstName\" {dir}, f.\"EmployeeId\" ASC"
        };
    }

    private static string BuildSql(string orderBy) => $$"""
        WITH RECURSIVE ranked_employment AS (
            SELECT em.*,
                ROW_NUMBER() OVER (
                    PARTITION BY em."EmployeeId"
                    ORDER BY
                        CASE
                            WHEN em."EffectiveFrom" <= @today AND (em."EffectiveTo" IS NULL OR @today < em."EffectiveTo") THEN 0
                            WHEN em."EffectiveFrom" > @today THEN 1
                            ELSE 2
                        END,
                        CASE WHEN em."EffectiveFrom" > @today THEN em."EffectiveFrom" END ASC NULLS LAST,
                        CASE WHEN em."EffectiveFrom" <= @today AND em."EffectiveTo" IS NOT NULL THEN em."EffectiveTo" END DESC NULLS LAST,
                        em."EffectiveFrom" DESC,
                        em."Id" ASC) AS rn
            FROM "corehr"."Employments" em
            WHERE em."TenantId" = @tenantId
        ),
        facts AS (
            SELECT e."Id" AS "EmployeeId", e."StableEmployeeKey" AS "EmployeeKey",
                e."EmployeeNumber", e."FirstName", e."LastName", e."Email" AS "WorkEmail",
                COALESCE(NULLIF(e."PreferredName", ''), e."FirstName") || ' ' || e."LastName" AS "DisplayName",
                re."Id" AS "EmploymentId", re."EffectiveFrom" AS "EmploymentStart", re."EffectiveTo" AS "EmploymentEnd",
                CASE
                    WHEN re."Id" IS NULL THEN 'Incomplete'
                    WHEN re."EffectiveFrom" <= @today AND (re."EffectiveTo" IS NULL OR @today < re."EffectiveTo") THEN 'Active'
                    WHEN re."EffectiveFrom" > @today THEN 'Scheduled'
                    ELSE 'Former'
                END AS "EmploymentState",
                CASE
                    WHEN re."Id" IS NULL THEN @today
                    WHEN re."EffectiveFrom" <= @today AND (re."EffectiveTo" IS NULL OR @today < re."EffectiveTo") THEN @today
                    WHEN re."EffectiveFrom" > @today THEN re."EffectiveFrom"
                    ELSE GREATEST(re."EffectiveFrom", re."EffectiveTo" - INTERVAL '1 microsecond')
                END AS "DisplayAt"
            FROM "corehr"."Employees" e
            LEFT JOIN ranked_employment re ON re."EmployeeId" = e."Id" AND re.rn = 1
            WHERE e."TenantId" = @tenantId
        ),
        work_facts AS (
            SELECT f.*, wa."Id" AS "WorkAssignmentId", wa."OrgUnitId", wa."JobTitle", wa."WorkLocation",
                wa."EffectiveFrom" AS "WorkEffectiveFrom", ous."Name" AS "OrganizationName", ous."ParentOrgUnitId"
            FROM facts f
            LEFT JOIN LATERAL (
                SELECT w.* FROM "corehr"."WorkAssignments" w
                WHERE w."TenantId" = @tenantId AND w."EmployeeId" = f."EmployeeId"
                    AND w."EmploymentId" = f."EmploymentId" AND w."IsPrimary" = TRUE
                    AND w."EffectiveFrom" <= f."DisplayAt"
                    AND (w."EffectiveTo" IS NULL OR f."DisplayAt" < w."EffectiveTo")
                ORDER BY w."EffectiveFrom" DESC, w."Id" ASC LIMIT 1
            ) wa ON TRUE
            LEFT JOIN LATERAL (
                SELECT s."Name", s."ParentOrgUnitId" FROM "corehr"."OrgUnitEffectiveStates" s
                WHERE s."TenantId" = @tenantId AND s."OrgUnitId" = wa."OrgUnitId"
                    AND s."EffectiveFrom" <= f."DisplayAt"::date
                    AND (s."EffectiveTo" IS NULL OR f."DisplayAt"::date < s."EffectiveTo")
                ORDER BY s."EffectiveFrom" DESC LIMIT 1
            ) ous ON TRUE
        ),
        org_paths AS (
            SELECT wf."EmployeeId", wf."OrgUnitId" AS "CurrentOrgUnitId", wf."ParentOrgUnitId",
                wf."OrganizationName"::text AS "OrganizationPath", 0 AS depth
            FROM work_facts wf WHERE wf."OrgUnitId" IS NOT NULL AND wf."OrganizationName" IS NOT NULL
            UNION ALL
            SELECT op."EmployeeId", parent."OrgUnitId", parent."ParentOrgUnitId",
                parent."Name" || ' / ' || op."OrganizationPath", op.depth + 1
            FROM org_paths op
            JOIN work_facts wf ON wf."EmployeeId" = op."EmployeeId"
            JOIN "corehr"."OrgUnitEffectiveStates" parent ON parent."TenantId" = @tenantId
                AND parent."OrgUnitId" = op."ParentOrgUnitId"
                AND parent."EffectiveFrom" <= wf."DisplayAt"::date
                AND (parent."EffectiveTo" IS NULL OR wf."DisplayAt"::date < parent."EffectiveTo")
            WHERE op.depth < 100
        ),
        enriched AS (
            SELECT wf.*, path."OrganizationPath",
                me."StableEmployeeKey" AS "ManagerEmployeeKey",
                COALESCE(NULLIF(me."PreferredName", ''), me."FirstName") || ' ' || me."LastName" AS "ManagerDisplayName",
                me."EmployeeNumber" AS "ManagerEmployeeNumber"
            FROM work_facts wf
            LEFT JOIN LATERAL (
                SELECT op."OrganizationPath" FROM org_paths op
                WHERE op."EmployeeId" = wf."EmployeeId" ORDER BY op.depth DESC LIMIT 1
            ) path ON TRUE
            LEFT JOIN LATERAL (
                SELECT mr."ManagerEmployeeId" FROM "corehr"."ManagerRelationships" mr
                WHERE mr."TenantId" = @tenantId AND mr."SubjectEmployeeId" = wf."EmployeeId"
                    AND mr."SubjectWorkAssignmentId" = wf."WorkAssignmentId" AND mr."Type" = 'PrimaryManager'
                    AND mr."EffectiveFrom" <= wf."DisplayAt"
                    AND (mr."EffectiveTo" IS NULL OR wf."DisplayAt" < mr."EffectiveTo")
                ORDER BY mr."EffectiveFrom" DESC, mr."Id" ASC LIMIT 1
            ) manager ON TRUE
            LEFT JOIN "corehr"."Employees" me ON me."TenantId" = @tenantId AND me."Id" = manager."ManagerEmployeeId"
        ),
        filtered AS (
            SELECT f.* FROM enriched f
            WHERE (@q IS NULL OR lower(f."DisplayName") LIKE '%' || @q || '%'
                    OR lower(f."EmployeeNumber") LIKE '%' || @q || '%'
                    OR lower(COALESCE(f."WorkEmail", '')) LIKE '%' || @q || '%')
                AND (@state IS NULL OR f."EmploymentState" = @state)
                AND (@orgUnitId IS NULL
                    OR (@orgScope = 'Direct' AND f."OrgUnitId" = @orgUnitId)
                    OR (@orgScope = 'Subtree' AND EXISTS (
                        SELECT 1 FROM org_paths op
                        WHERE op."EmployeeId" = f."EmployeeId" AND op."CurrentOrgUnitId" = @orgUnitId)))
        )
        SELECT f.*, COUNT(*) OVER()::int AS "TotalCount"
        FROM filtered f
        ORDER BY {{orderBy}}
        OFFSET @offset LIMIT @limit
        """;

    private static void AddParameter(DbCommand command, string name, object value, DbType? dbType = null)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        if (dbType.HasValue)
            parameter.DbType = dbType.Value;
        command.Parameters.Add(parameter);
    }

    private static string? GetNullableString(DbDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static DateTime? GetNullableDateTime(DbDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }
}

using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.People;

/// <summary>A colleague to choose: just enough to tell people apart, nothing about their employment or contact.</summary>
public sealed record DirectoryPersonDto(Guid EmployeeId, string DisplayName, string? JobTitle, string? OrgUnitName);

public sealed record SearchPeopleDirectoryQuery(string? Search) : IQuery<Result<IReadOnlyList<DirectoryPersonDto>>>;

/// <summary>
/// The colleague picker behind feedback, requests and praise. Core HR's own people search follows the caller's view
/// scope, so an employee finds only themselves there; this reads active colleagues through the signed internal
/// contract instead, tenant-bound, at most 20, with names, titles and teams only.
/// </summary>
public sealed class SearchPeopleDirectoryHandler(ICoreWorkforceClient workforce)
    : IQueryHandler<SearchPeopleDirectoryQuery, Result<IReadOnlyList<DirectoryPersonDto>>>
{
    public const int MinTermLength = 2;
    public const int MaxResults = 20;

    public async Task<Result<IReadOnlyList<DirectoryPersonDto>>> Handle(SearchPeopleDirectoryQuery query, CancellationToken token)
    {
        var term = query.Search?.Trim() ?? string.Empty;
        if (term.Length < MinTermLength) return Result.Success<IReadOnlyList<DirectoryPersonDto>>([]);
        var found = await workforce.SearchAsync(DateTime.UtcNow, term.Length > 100 ? term[..100] : term, MaxResults, token);
        return Result.Success<IReadOnlyList<DirectoryPersonDto>>(found.Where(p => p.IsActive).Take(MaxResults)
            .Select(p => new DirectoryPersonDto(p.EmployeeId, p.DisplayName, p.JobTitle, p.OrgUnit?.Name)).ToList());
    }
}

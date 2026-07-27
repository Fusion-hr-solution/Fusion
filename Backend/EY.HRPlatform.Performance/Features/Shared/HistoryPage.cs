using EY.HRPlatform.Performance.Models.Responses;

namespace EY.HRPlatform.Performance.Features.Shared;

/// <summary>
/// Server-enforced paging for the append-only histories — progress updates, activity, and the two
/// audit trails. These series only grow, so an unbounded read is a cost that rises with the tenant's
/// age rather than with what the caller asked for.
/// </summary>
/// <remarks>
/// An oversized request is clamped rather than rejected: the caller asked for more than the server
/// will serve, which is not an error the user can act on. A page past the end returns an empty page
/// with the true total, so a client can tell "no more" from "nothing here".
/// </remarks>
public readonly record struct HistoryPage
{
    public const int DefaultPageSize = 25;
    public const int MaxPageSize = 200;

    private HistoryPage(int page, int pageSize)
    {
        Page = page;
        PageSize = pageSize;
    }

    public int Page { get; }
    public int PageSize { get; }
    public int Skip => (Page - 1) * PageSize;

    /// <summary>Clamps a requested page and size into the served range.</summary>
    public static HistoryPage From(int? page, int? pageSize) => new(
        page is null or < 1 ? 1 : page.Value,
        pageSize switch
        {
            null or < 1 => DefaultPageSize,
            > MaxPageSize => MaxPageSize,
            _ => pageSize.Value
        });

    public PagedResponse<T> ToResponse<T>(List<T> items, int totalCount) => new()
    {
        Items = items,
        TotalCount = totalCount,
        Page = Page,
        PageSize = PageSize
    };
}

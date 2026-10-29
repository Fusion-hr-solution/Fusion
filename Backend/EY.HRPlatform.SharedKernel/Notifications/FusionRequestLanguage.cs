using EY.HRPlatform.SharedKernel.Localization;
using Microsoft.AspNetCore.Http;
using Microsoft.Net.Http.Headers;

namespace EY.HRPlatform.SharedKernel.Notifications;

/// <summary>
/// The language a request reads in. <c>@repo/api</c> sends the person's current language as <c>Accept-Language</c>;
/// the first tag Fusion speaks wins, else English.
/// </summary>
public static class FusionRequestLanguage
{
    public static string Of(HttpRequest request)
    {
        if (!StringWithQualityHeaderValue.TryParseList(request.Headers.AcceptLanguage, out var tags)) return FusionLanguages.Default;
        return tags.OrderByDescending(tag => tag.Quality ?? 1)
            .Select(tag => FusionLanguages.FromLocale(tag.Value.Value))
            .FirstOrDefault(language => language is not null) ?? FusionLanguages.Default;
    }
}

namespace EY.HRPlatform.Identity.Models.Requests;

/// <summary>
/// Validated by the endpoint, not by annotations, so every unusable value gets
/// the same stable failure code.
/// </summary>
public class SetAccountLanguageRequest
{
    public string? Language { get; set; }
}

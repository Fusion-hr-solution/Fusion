using System.Text.Json;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Services;

public static class DraftStructureJsonSerializer
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static string? SerializeAttributes(Dictionary<string, object?>? attributes)
    {
        if (attributes is null || attributes.Count == 0)
            return null;

        return JsonSerializer.Serialize(attributes, JsonOptions);
    }

    public static Dictionary<string, object?> DeserializeAttributes(string? attributesJson)
    {
        if (string.IsNullOrWhiteSpace(attributesJson))
            return new Dictionary<string, object?>();

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object?>>(attributesJson, JsonOptions)
                ?? new Dictionary<string, object?>();
        }
        catch (JsonException)
        {
            return new Dictionary<string, object?>();
        }
        catch (NotSupportedException)
        {
            return new Dictionary<string, object?>();
        }
    }

    public static T Deserialize<T>(string? json, T fallback)
    {
        if (string.IsNullOrWhiteSpace(json))
            return fallback;

        return JsonSerializer.Deserialize<T>(json, JsonOptions) ?? fallback;
    }

    public static string SerializeObject<TValue>(TValue value)
        => JsonSerializer.Serialize(value, JsonOptions);
}
namespace EY.HRPlatform.Interview.Features.Grading.Groq;

/// <summary>
/// Builds Groq <c>response_format</c> values for structured output.
/// </summary>
public static class JsonSchemaFormat
{
    /// <summary>
    /// A strict JSON-schema response format, supported by the gpt-oss models.
    /// Strict mode requires the schema root to be an object, every property to be
    /// listed in <c>required</c>, and every object to set
    /// <c>additionalProperties: false</c> — callers' schemas must honour that.
    /// </summary>
    public static object Strict(string name, object schema) => new
    {
        type = "json_schema",
        json_schema = new { name, strict = true, schema },
    };
}

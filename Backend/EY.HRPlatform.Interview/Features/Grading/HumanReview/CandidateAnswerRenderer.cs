using System.Text;
using System.Text.Json;
using EY.HRPlatform.Interview.Domain.Entities;

namespace EY.HRPlatform.Interview.Features.Grading.HumanReview;

/// <summary>
/// Turns a stored candidate answer into something a human reviewer can actually read.
/// </summary>
/// <remarks>
/// Multi-file answers (Frontend Project, multi-file Coding) are stored as a serialized project —
/// <c>{"entry":"…","files":[{"path":…,"content":…}]}</c> — so the review queue used to show one
/// unbroken line of doubly-escaped JSON with the file the candidate actually worked in buried
/// behind untouched scaffolding. This unpacks it into labelled per-file sections and leads with
/// what changed, so the reviewer reads code instead of JSON.
/// </remarks>
public static class CandidateAnswerRenderer
{
    public static string Render(CandidateAnswer answer, Question question)
    {
        if (answer.SelectedOptionIds.Count > 0)
        {
            var textById = question.Options
                .GroupBy(o => o.Id.ToString(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Text, StringComparer.OrdinalIgnoreCase);

            var labels = answer.SelectedOptionIds
                .Select(id => textById.TryGetValue(id, out var text) ? text : id);

            return string.Join(", ", labels);
        }

        return RenderProject(answer.AnswerText, question.ProjectFiles) ?? answer.AnswerText;
    }

    /// <summary>Renders a serialized project as readable sections, or null when the answer isn't one.</summary>
    private static string? RenderProject(string answerText, string? starterJson)
    {
        if (string.IsNullOrWhiteSpace(answerText) || !answerText.TrimStart().StartsWith('{'))
            return null;

        var files = ReadFiles(answerText, out var entry);
        if (files.Count == 0)
            return null;

        // Compare against the question's starter so the reviewer sees what the candidate did,
        // not the scaffolding they were handed.
        var starter = ReadFiles(starterJson, out _);
        var starterByPath = starter.ToDictionary(f => f.Path, f => f.Content, StringComparer.OrdinalIgnoreCase);

        var annotated = files.Select(file =>
        {
            var isEntry = string.Equals(file.Path, entry, StringComparison.OrdinalIgnoreCase);
            string state;
            if (starterByPath.Count == 0)
                state = string.Empty;                                   // no starter to compare against
            else if (!starterByPath.TryGetValue(file.Path, out var original))
                state = "added";
            else
                state = Normalize(original) == Normalize(file.Content) ? "unchanged" : "modified";

            return (file.Path, file.Content, IsEntry: isEntry, State: state);
        });

        var ordered = annotated
            .OrderBy(f => f.State switch { "modified" => 0, "added" => 1, "" => 2, _ => 3 })
            .ThenByDescending(f => f.IsEntry)
            .ThenBy(f => f.Path, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var builder = new StringBuilder();
        foreach (var file in ordered)
        {
            var tags = new List<string>(2);
            if (file.IsEntry) tags.Add("entry");
            if (file.State.Length > 0) tags.Add(file.State);

            if (builder.Length > 0) builder.Append('\n');
            builder.Append("──── ").Append(file.Path);
            if (tags.Count > 0) builder.Append("  (").Append(string.Join(", ", tags)).Append(')');
            builder.Append('\n').Append(file.Content.TrimEnd()).Append('\n');
        }

        return builder.ToString();
    }

    private static List<(string Path, string Content)> ReadFiles(string? projectJson, out string entry)
    {
        entry = string.Empty;
        var files = new List<(string, string)>();
        if (string.IsNullOrWhiteSpace(projectJson))
            return files;

        try
        {
            using var doc = JsonDocument.Parse(projectJson);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("files", out var filesEl) ||
                filesEl.ValueKind != JsonValueKind.Array)
                return files;

            if (root.TryGetProperty("entry", out var entryEl) && entryEl.ValueKind == JsonValueKind.String)
                entry = entryEl.GetString() ?? string.Empty;

            foreach (var element in filesEl.EnumerateArray())
            {
                if (element.ValueKind != JsonValueKind.Object)
                    continue;

                var path = ReadString(element, "path");
                if (path.Length == 0)
                    continue;

                files.Add((path, ReadString(element, "content")));
            }
        }
        catch (JsonException)
        {
            // Not a project payload (or corrupt) — the caller falls back to the raw answer.
            files.Clear();
        }

        return files;
    }

    private static string ReadString(JsonElement element, string name) =>
        element.TryGetProperty(name, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString() ?? string.Empty
            : string.Empty;

    /// <summary>Line-ending- and trailing-whitespace-insensitive, so an editor rewrite isn't a "change".</summary>
    private static string Normalize(string content) =>
        content.Replace("\r\n", "\n").Replace('\r', '\n').TrimEnd();
}

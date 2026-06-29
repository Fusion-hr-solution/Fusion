using System.IO.Compression;
using System.Text;
using EY.HRPlatform.Interview.Models.Common;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.Interview.Features.Grading.Judge0;

public sealed record ProjectFile(string Path, string Content);

/// <summary>Result of packaging a project: the entry file's content (sent as Judge0's
/// <c>source_code</c>) and a base64 zip of all files (sent as <c>additional_files</c>,
/// extracted into the run's working directory so imports resolve).</summary>
public sealed record Judge0Project(string EntryContent, string AdditionalFilesBase64);

/// <summary>
/// Packages a multi-file project into a Judge0 submission. Validates path safety and size
/// caps first (to prevent zip path traversal / abuse and bound work), then zips.
/// </summary>
public static class Judge0ProjectBuilder
{
    public const int MaxFiles = 20;
    public const int MaxTotalBytes = 256 * 1024;
    private const int MaxPathLength = 200;

    public static Judge0Project Build(IReadOnlyList<ProjectFile> files, string? entryPath)
    {
        if (files is null || files.Count == 0)
            throw Bad("At least one file is required.");
        if (files.Count > MaxFiles)
            throw Bad($"Too many files (max {MaxFiles}).");
        if (string.IsNullOrWhiteSpace(entryPath))
            throw Bad("An entry file is required.");

        var normalizedEntry = NormalizePath(entryPath);

        // Pass 1: validate every file, dedup paths, bound total size, and locate the entry.
        // Encode each file's bytes once here and reuse them when zipping below.
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var validated = new List<(string Path, byte[] Bytes)>(files.Count);
        var totalBytes = 0;
        string? entryContent = null;

        foreach (var file in files)
        {
            var path = ValidatePath(file.Path);
            if (!seen.Add(path))
                throw Bad($"Duplicate file path: {path}");

            var content = file.Content ?? string.Empty;
            var bytes = Encoding.UTF8.GetBytes(content);
            totalBytes += bytes.Length;
            if (totalBytes > MaxTotalBytes)
                throw Bad($"Project is too large (max {MaxTotalBytes / 1024} KB).");

            if (string.Equals(path, normalizedEntry, StringComparison.OrdinalIgnoreCase))
                entryContent = content;

            validated.Add((path, bytes));
        }

        if (entryContent is null)
            throw Bad("The entry file must be one of the project files.");

        // Pass 2: zip all files at their relative paths (the entry is also included so a sibling
        // that imports it by name resolves; Judge0 runs the entry from source_code).
        using var buffer = new MemoryStream();
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var (path, bytes) in validated)
            {
                var entry = archive.CreateEntry(path, CompressionLevel.Fastest);
                using var entryStream = entry.Open();
                entryStream.Write(bytes, 0, bytes.Length);
            }
        }

        return new Judge0Project(entryContent, Convert.ToBase64String(buffer.ToArray()));
    }

    private static string NormalizePath(string path) => path.Trim().Replace('\\', '/');

    private static string ValidatePath(string? rawPath)
    {
        if (string.IsNullOrWhiteSpace(rawPath))
            throw Bad("File path is required.");

        var path = NormalizePath(rawPath);
        if (path.Length > MaxPathLength)
            throw Bad("File path is too long.");
        if (path.StartsWith('/') || (path.Length >= 2 && path[1] == ':'))
            throw Bad($"File path must be relative: {path}");

        foreach (var segment in path.Split('/'))
        {
            if (segment.Length == 0 || segment is "." or "..")
                throw Bad($"Invalid file path: {path}");
            foreach (var ch in segment)
            {
                // ASCII letters/digits only (not char.IsLetterOrDigit, which spans the whole
                // Unicode letter range) plus '.', '_', '-' — keeps filenames predictable on the
                // Linux sandbox and rules out homoglyph/RTL surprises.
                var isAsciiAlphaNumeric =
                    ch is (>= 'a' and <= 'z') or (>= 'A' and <= 'Z') or (>= '0' and <= '9');
                if (!isAsciiAlphaNumeric && ch is not ('.' or '_' or '-'))
                    throw Bad($"File path has invalid characters: {path}");
            }
        }

        return path;
    }

    private static ApiException Bad(string message) =>
        new(message, StatusCodes.Status400BadRequest);
}

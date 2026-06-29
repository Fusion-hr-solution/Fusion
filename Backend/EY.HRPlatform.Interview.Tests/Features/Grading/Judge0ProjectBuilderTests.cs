using System.IO.Compression;
using EY.HRPlatform.Interview.Features.Grading.Judge0;
using EY.HRPlatform.Interview.Models.Common;

namespace EY.HRPlatform.Interview.Tests.Features.Grading;

public class Judge0ProjectBuilderTests
{
    private static ProjectFile F(string path, string content = "x") => new(path, content);

    [Fact]
    public void Build_PackagesAllFiles_AndReturnsEntryContent()
    {
        var files = new List<ProjectFile>
        {
            F("main.py", "import util\nprint(util.x)"),
            F("util.py", "x = 1"),
        };

        var project = Judge0ProjectBuilder.Build(files, "main.py");

        Assert.Equal("import util\nprint(util.x)", project.EntryContent);
        var names = ZipEntryNames(project.AdditionalFilesBase64);
        Assert.Contains("main.py", names);
        Assert.Contains("util.py", names);
    }

    [Fact]
    public void Build_AllowsSubfolders()
    {
        var files = new List<ProjectFile> { F("src/main.py", "print(1)"), F("src/util.py", "x=1") };
        var project = Judge0ProjectBuilder.Build(files, "src/main.py");
        Assert.Contains("src/util.py", ZipEntryNames(project.AdditionalFilesBase64));
    }

    [Fact]
    public void Build_MatchesEntryCaseInsensitively()
    {
        var project = Judge0ProjectBuilder.Build([F("Main.py", "print(1)")], "main.py");
        Assert.Equal("print(1)", project.EntryContent);
    }

    [Theory]
    [InlineData("../escape.py")]
    [InlineData("a/../b.py")]
    [InlineData("/etc/passwd")]
    [InlineData("C:/win.py")]
    [InlineData("bad name.py")]
    public void Build_RejectsUnsafePaths(string path)
    {
        var ex = Assert.Throws<ApiException>(() => Judge0ProjectBuilder.Build([F(path)], path));
        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public void Build_RejectsTooManyFiles()
    {
        var files = Enumerable.Range(0, Judge0ProjectBuilder.MaxFiles + 1).Select(i => F($"f{i}.py")).ToList();
        var ex = Assert.Throws<ApiException>(() => Judge0ProjectBuilder.Build(files, "f0.py"));
        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public void Build_RejectsOversizedProject()
    {
        var big = new string('a', Judge0ProjectBuilder.MaxTotalBytes + 1);
        var ex = Assert.Throws<ApiException>(() => Judge0ProjectBuilder.Build([F("main.py", big)], "main.py"));
        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public void Build_RejectsDuplicatePaths()
    {
        var ex = Assert.Throws<ApiException>(() => Judge0ProjectBuilder.Build([F("main.py"), F("main.py")], "main.py"));
        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public void Build_RejectsEntryNotInFiles()
    {
        var ex = Assert.Throws<ApiException>(() => Judge0ProjectBuilder.Build([F("main.py")], "other.py"));
        Assert.Equal(400, ex.StatusCode);
    }

    [Fact]
    public void Build_RejectsEmptyProject()
    {
        var ex = Assert.Throws<ApiException>(() => Judge0ProjectBuilder.Build([], "main.py"));
        Assert.Equal(400, ex.StatusCode);
    }

    private static List<string> ZipEntryNames(string base64)
    {
        using var ms = new MemoryStream(Convert.FromBase64String(base64));
        using var zip = new ZipArchive(ms, ZipArchiveMode.Read);
        return zip.Entries.Select(e => e.FullName).ToList();
    }
}

using EY.HRPlatform.Performance.Infrastructure.Attachments;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Infrastructure;

/// <summary>
/// Attachment hardening: bytes are verified against the declared type, storage keys cannot escape
/// their root, and both storage backends behave identically.
/// </summary>
public sealed class AttachmentHardeningTests
{
    private static readonly byte[] Pdf = [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37];
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00];
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
    private static readonly byte[] Zip = [0x50, 0x4B, 0x03, 0x04, 0x14, 0x00];
    private static readonly byte[] WindowsExecutable = [0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00];

    // ── Magic-byte verification ────────────────────────────────────────────────

    [Fact]
    public void A_matching_file_is_accepted()
    {
        Assert.True(ContentTypeVerifier.Matches("application/pdf", Pdf));
        Assert.True(ContentTypeVerifier.Matches("image/png", Png));
        Assert.True(ContentTypeVerifier.Matches("image/jpeg", Jpeg));
    }

    [Fact]
    public void An_executable_renamed_as_a_pdf_is_rejected()
    {
        // The whole point: the allow-list only sees the declared type, so without a byte check this
        // would pass and later be served back under a type a browser may act on.
        Assert.False(ContentTypeVerifier.Matches("application/pdf", WindowsExecutable));
    }

    [Fact]
    public void A_png_declared_as_a_pdf_is_rejected()
        => Assert.False(ContentTypeVerifier.Matches("application/pdf", Png));

    [Fact]
    public void An_empty_or_truncated_file_cannot_satisfy_a_signature()
    {
        Assert.False(ContentTypeVerifier.Matches("application/pdf", []));
        Assert.False(ContentTypeVerifier.Matches("image/png", [0x89, 0x50]));
    }

    [Fact]
    public void The_openxml_formats_verify_as_zip_containers()
    {
        Assert.True(ContentTypeVerifier.Matches(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Zip));
        Assert.True(ContentTypeVerifier.Matches(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", Zip));
    }

    [Fact]
    public void Text_formats_have_no_signature_and_are_accepted_on_declaration()
    {
        // Structurally indistinguishable from arbitrary bytes. nosniff plus an attachment
        // disposition is what keeps them inert, not a signature check.
        Assert.True(ContentTypeVerifier.Matches("text/plain", WindowsExecutable));
        Assert.False(ContentTypeVerifier.IsVerifiable("text/plain"));
        Assert.False(ContentTypeVerifier.IsVerifiable("text/csv"));
    }

    [Fact]
    public void An_unknown_type_is_allowed_rather_than_rejected_on_ignorance()
    {
        // So extending the allow-list does not silently break uploads.
        Assert.True(ContentTypeVerifier.Matches("application/x-newly-allowed", WindowsExecutable));
        Assert.False(ContentTypeVerifier.IsVerifiable("application/x-newly-allowed"));
    }

    // ── Storage-root containment ───────────────────────────────────────────────

    private static FileSystemAttachmentStorage BuildFileSystemStorage(string root)
        => new(Options.Create(new AttachmentOptions { StorageRoot = root }));

    [Fact]
    public async Task A_sibling_directory_sharing_the_roots_prefix_is_rejected()
    {
        var baseDirectory = Path.Combine(Path.GetTempPath(), $"fusion-attach-{Guid.NewGuid():N}");
        var root = Path.Combine(baseDirectory, "attachments");
        Directory.CreateDirectory(root);

        try
        {
            var storage = BuildFileSystemStorage(root);

            // "…/attachments-elsewhere" is a textual prefix match on "…/attachments" but is not
            // inside it. A prefix check would have accepted this.
            await Assert.ThrowsAsync<ArgumentException>(() => storage.OpenReadAsync(
                "../attachments-elsewhere/secret", CancellationToken.None));
        }
        finally
        {
            Directory.Delete(baseDirectory, recursive: true);
        }
    }

    [Theory]
    [InlineData("../../etc/passwd")]
    [InlineData("./../secret")]
    [InlineData("tenant/..")]
    [InlineData("tenant\\..\\secret")]
    public async Task Traversal_keys_are_rejected(string storageKey)
    {
        var root = Path.Combine(Path.GetTempPath(), $"fusion-attach-{Guid.NewGuid():N}");
        Directory.CreateDirectory(root);

        try
        {
            var storage = BuildFileSystemStorage(root);
            await Assert.ThrowsAsync<ArgumentException>(
                () => storage.OpenReadAsync(storageKey, CancellationToken.None));
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void Both_backends_reject_the_same_keys()
    {
        foreach (var key in new[] { "", "   ", "..", "./..", "tenant\\..\\x" })
        {
            Assert.Throws<ArgumentException>(() => StorageKeyGuard.Validate(key));
        }

        // A well-formed, tenant-partitioned key passes.
        StorageKeyGuard.Validate($"{Guid.NewGuid()}/{Guid.NewGuid()}");
    }

    // ── Backend equivalence ────────────────────────────────────────────────────

    [Fact]
    public async Task Bytes_written_through_the_database_backend_read_back_unchanged()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"attach-blob-{Guid.NewGuid()}";
        var storageKey = $"{tenantId}/{Guid.NewGuid()}";

        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            await new PostgresAttachmentStorage(db).PutAsync(
                storageKey, new MemoryStream(Pdf), CancellationToken.None);
        }

        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            await using var stream = await new PostgresAttachmentStorage(db)
                .OpenReadAsync(storageKey, CancellationToken.None);

            Assert.NotNull(stream);
            using var buffer = new MemoryStream();
            await stream!.CopyToAsync(buffer);
            Assert.Equal(Pdf, buffer.ToArray());
        }
    }

    [Fact]
    public async Task A_missing_key_reads_as_absent_rather_than_throwing()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _, $"attach-missing-{Guid.NewGuid()}");

        Assert.Null(await new PostgresAttachmentStorage(db)
            .OpenReadAsync($"{tenantId}/{Guid.NewGuid()}", CancellationToken.None));
    }

    [Fact]
    public async Task Re_putting_a_key_replaces_its_bytes_as_the_filesystem_backend_does()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"attach-replace-{Guid.NewGuid()}";
        var storageKey = $"{tenantId}/{Guid.NewGuid()}";

        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var storage = new PostgresAttachmentStorage(db);
            await storage.PutAsync(storageKey, new MemoryStream(Pdf), CancellationToken.None);
            await storage.PutAsync(storageKey, new MemoryStream(Png), CancellationToken.None);
        }

        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            await using var stream = await new PostgresAttachmentStorage(db)
                .OpenReadAsync(storageKey, CancellationToken.None);

            using var buffer = new MemoryStream();
            await stream!.CopyToAsync(buffer);
            Assert.Equal(Png, buffer.ToArray());

            // One row per key, not an accumulating history.
            Assert.Equal(1, db.AttachmentBlobs.Count(blob => blob.StorageKey == storageKey));
        }
    }

    [Fact]
    public async Task A_deleted_key_reads_as_absent_on_the_database_backend()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"attach-delete-{Guid.NewGuid()}";
        var storageKey = $"{tenantId}/{Guid.NewGuid()}";

        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var storage = new PostgresAttachmentStorage(db);
            await storage.PutAsync(storageKey, new MemoryStream(Pdf), CancellationToken.None);
        }

        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            // The cleanup sweep reaps through IAttachmentStorage, so this is the same call it makes.
            var blob = db.AttachmentBlobs.Single(item => item.StorageKey == storageKey);
            db.AttachmentBlobs.Remove(blob);
            await db.SaveChangesAsync();
        }

        await using (var db = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            Assert.Null(await new PostgresAttachmentStorage(db)
                .OpenReadAsync(storageKey, CancellationToken.None));
        }
    }
}

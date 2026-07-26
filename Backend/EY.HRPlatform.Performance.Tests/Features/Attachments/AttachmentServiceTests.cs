using System.Reflection;
using System.Text;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.Attachments;
using EY.HRPlatform.Performance.Infrastructure.Attachments;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Attachments;

public sealed class AttachmentServiceTests : IDisposable
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"attach-tests-{Guid.NewGuid():N}");

    private AttachmentService BuildService(PerformanceDbContext db, TenantContext tenant, AttachmentOptions? opts = null)
    {
        var options = Options.Create(opts ?? new AttachmentOptions { StorageRoot = _root });
        options.Value.StorageRoot = _root;
        var storage = new FileSystemAttachmentStorage(options);
        var activity = new ActivityLogWriter(db, tenant, new StubCurrentUserContext());
        return new AttachmentService(db, storage, activity, tenant,
            new StubCurrentUserContext { UserId = Guid.NewGuid() }, options);
    }

    private static Stream Bytes(string content) => new MemoryStream(Encoding.UTF8.GetBytes(content));

    [Fact]
    public async Task Upload_RecordsMetadataBytesAndAudit()
    {
        await using var db = PerformanceTestContext.Create(TenantId, out var tenant);
        var service = BuildService(db, tenant);

        var result = await service.UploadAsync("FeedbackResponse", Guid.NewGuid(), "note.txt", "text/plain",
            Bytes("hello world"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var stored = await db.Attachments.SingleAsync();
        Assert.Equal(AttachmentStatus.Committed, stored.Status);
        Assert.Equal(11, stored.SizeBytes);
        Assert.True(File.Exists(Path.Combine(_root, stored.StorageKey.Replace('/', Path.DirectorySeparatorChar))));
        Assert.Contains(await db.ActivityLogEntries.ToListAsync(), a => a.Action == "AttachmentUploaded");
    }

    [Fact]
    public async Task Upload_Oversized_Rejected_NoBytesStored()
    {
        await using var db = PerformanceTestContext.Create(TenantId, out var tenant);
        var service = BuildService(db, tenant, new AttachmentOptions { StorageRoot = _root, MaxSizeBytes = 4 });

        var result = await service.UploadAsync("FeedbackResponse", null, "big.txt", "text/plain",
            Bytes("way too large"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Attachment.TooLarge", result.Error.Code);
        Assert.Equal(0, await db.Attachments.CountAsync());
        Assert.False(Directory.Exists(_root) && Directory.EnumerateFiles(_root, "*", SearchOption.AllDirectories).Any());
    }

    [Fact]
    public async Task Upload_DisallowedType_Rejected()
    {
        await using var db = PerformanceTestContext.Create(TenantId, out var tenant);
        var service = BuildService(db, tenant,
            new AttachmentOptions { StorageRoot = _root, AllowedContentTypes = ["application/pdf"] });

        var result = await service.UploadAsync("FeedbackResponse", null, "x.exe", "application/x-msdownload",
            Bytes("MZ"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Attachment.TypeNotAllowed", result.Error.Code);
        Assert.Equal(0, await db.Attachments.CountAsync());
    }

    [Fact]
    public async Task Upload_WithoutAuthenticatedUploader_Rejected()
    {
        await using var db = PerformanceTestContext.Create(TenantId, out var tenant);
        var options = Options.Create(new AttachmentOptions { StorageRoot = _root });
        var storage = new FileSystemAttachmentStorage(options);
        var activity = new ActivityLogWriter(db, tenant, new StubCurrentUserContext());
        var service = new AttachmentService(db, storage, activity, tenant,
            new StubCurrentUserContext { UserId = null }, options);

        var result = await service.UploadAsync("FeedbackResponse", null, "n.txt", "text/plain",
            Bytes("hello"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Attachment.Unauthenticated", result.Error.Code);
        Assert.Equal(0, await db.Attachments.CountAsync());
    }

    [Fact]
    public async Task Download_Authorized_StreamsBytes()
    {
        var dbName = $"attach-dl-{Guid.NewGuid()}";
        Guid attachmentId;
        await using (var db = PerformanceTestContext.Create(TenantId, out var tenant, dbName))
        {
            var service = BuildService(db, tenant);
            var upload = await service.UploadAsync("FeedbackResponse", null, "note.txt", "text/plain",
                Bytes("payload"), CancellationToken.None);
            attachmentId = upload.Value.Id;
        }

        await using (var db = PerformanceTestContext.Create(TenantId, out var tenant, dbName))
        {
            var service = BuildService(db, tenant);
            var result = await service.DownloadAsync(attachmentId, _ => Task.FromResult(true), CancellationToken.None);

            Assert.True(result.IsSuccess);
            using var reader = new StreamReader(result.Value.Content);
            Assert.Equal("payload", await reader.ReadToEndAsync());
            Assert.Equal("note.txt", result.Value.FileName);
        }
    }

    [Fact]
    public async Task Download_Unauthorized_Denied()
    {
        await using var db = PerformanceTestContext.Create(TenantId, out var tenant);
        var service = BuildService(db, tenant);
        var upload = await service.UploadAsync("FeedbackResponse", null, "n.txt", "text/plain",
            Bytes("secret"), CancellationToken.None);

        var result = await service.DownloadAsync(upload.Value.Id, _ => Task.FromResult(false), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Attachment.Forbidden", result.Error.Code);
    }

    [Fact]
    public async Task Download_CrossTenant_NotFound()
    {
        var dbName = $"attach-tenant-{Guid.NewGuid()}";
        Guid attachmentId;
        await using (var db = PerformanceTestContext.Create(TenantId, out var tenant, dbName))
        {
            var service = BuildService(db, tenant);
            var upload = await service.UploadAsync("FeedbackResponse", null, "n.txt", "text/plain",
                Bytes("secret"), CancellationToken.None);
            attachmentId = upload.Value.Id;
        }

        await using var otherDb = PerformanceTestContext.Create(Guid.NewGuid(), out var otherTenant, dbName);
        var otherService = BuildService(otherDb, otherTenant);
        var result = await otherService.DownloadAsync(attachmentId, _ => Task.FromResult(true), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Attachment.NotFound", result.Error.Code);
    }

    public void Dispose()
    {
        try { if (Directory.Exists(_root)) Directory.Delete(_root, true); } catch { /* best-effort */ }
    }
}

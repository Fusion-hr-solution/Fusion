using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Infrastructure.Evidence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

public sealed class EvidenceUploadTests
{
    private sealed record Fixture(TestStore Store, TestEvidenceStore Files, FakeCoreWorkforceClient Core, Guid CycleId, Guid ObjectiveId, Guid OwnerId);

    private static async Task<Fixture> ArrangeAsync()
    {
        var store = TestStore.ForNewTenant(); var files = new TestEvidenceStore(store.TenantId);
        var core = new FakeCoreWorkforceClient(); var owner = core.Add("Owner").EmployeeId;
        var start = new DateOnly(2026, 1, 1); var end = new DateOnly(2026, 12, 31);
        var cycle = PerformanceCycle.CreateDraft(store.TenantId, "Evidence", start, end, start.AddDays(30)).Activated();
        var objective = Objective.CreateStrategic(store.TenantId, cycle.Id, "Direction", null, owner, start, end,
            ObjectiveMeasurement.ManualPercentage(), start, end); objective.Publish();
        await using var db = store.NewContext();
        db.Cycles.Add(cycle); db.Objectives.Add(objective); await db.SaveChangesAsync();
        return new(store, files, core, cycle.Id, objective.Id, owner);
    }

    private static FormFile File(byte[] bytes, string name = "proof.txt", string type = "text/plain", long? length = null)
        => new(new MemoryStream(bytes), 0, length ?? bytes.Length, "file", name)
        { Headers = new HeaderDictionary(), ContentType = type };

    [Theory]
    [InlineData("proof.exe", "application/octet-stream", "data")]
    [InlineData("proof.pdf", "text/plain", "%PDF-1.7")]
    [InlineData("proof.pdf", "application/pdf", "not a PDF")]
    [InlineData("proof.png", "image/png", "not a PNG")]
    [InlineData("proof.jpg", "image/jpeg", "not a JPEG")]
    [InlineData("proof.gif", "image/gif", "not a GIF")]
    [InlineData("proof.webp", "image/webp", "not a WebP")]
    public async Task Disallowed_or_mislabeled_files_never_create_a_file_or_upload(string name, string type, string body)
    {
        var f = await ArrangeAsync();
        await using var db = f.Store.NewContext();
        var result = await new UploadEvidenceHandler(db, f.Files).Handle(new(f.CycleId, f.ObjectiveId,
            File(System.Text.Encoding.UTF8.GetBytes(body), name, type), new(f.OwnerId, false, false)), default);
        Assert.Equal("Evidence.UploadInvalid", result.Error.Code);
        Assert.Empty(f.Files.Files); Assert.Empty(await db.EvidenceUploads.ToListAsync());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(20971521)]
    public async Task Empty_and_oversize_files_are_rejected(long size)
    {
        var f = await ArrangeAsync();
        await using var db = f.Store.NewContext();
        var result = await new UploadEvidenceHandler(db, f.Files).Handle(new(f.CycleId, f.ObjectiveId,
            File("proof"u8.ToArray(), length: size), new(f.OwnerId, false, false)), default);
        Assert.Equal("Evidence.UploadInvalid", result.Error.Code); Assert.Empty(f.Files.Files);
    }

    [Fact]
    public async Task A_file_at_the_twenty_megabyte_boundary_is_accepted()
    {
        var f = await ArrangeAsync();
        await using var db = f.Store.NewContext();
        var bytes = new byte[20 * 1024 * 1024];
        var result = await new UploadEvidenceHandler(db, f.Files).Handle(new(f.CycleId, f.ObjectiveId,
            File(bytes), new(f.OwnerId, false, false)), default);
        Assert.True(result.IsSuccess);
        Assert.Equal(bytes.LongLength, result.Value.SizeBytes);
    }

    [Fact]
    public async Task Duplicate_upload_ids_roll_back_the_claim_and_progress()
    {
        var f = await ArrangeAsync(); Guid uploadId;
        await using (var db = f.Store.NewContext())
        {
            uploadId = (await new UploadEvidenceHandler(db, f.Files).Handle(new(f.CycleId, f.ObjectiveId,
                File("proof"u8.ToArray()), new(f.OwnerId, false, false)), default)).Value.UploadId;
        }
        var item = new EvidenceInput(EvidenceKind.File, uploadId, null, null, null, null, null, null);
        await using (var db = f.Store.NewContext())
        {
            var request = new SubmitProgressRequest(30m, null, null, EY.HRPlatform.Performance.Domain.Progress.ObjectiveStatus.OnTrack, null, false, [item, item]);
            var result = await new SubmitProgressHandler(db, f.Core, f.Store.Tenant, new TestPerformanceAudit(db), f.Files, new PerformanceNotifications(db))
                .Handle(new(f.CycleId, f.ObjectiveId, request, new(f.OwnerId, false, false)), default);
            Assert.Equal("Evidence.UploadInvalid", result.Error.Code);
        }
        await using var verify = f.Store.NewContext();
        Assert.Null((await verify.EvidenceUploads.SingleAsync()).ClaimedAt);
        Assert.Empty(await verify.ProgressUpdates.ToListAsync());
        Assert.Null((await verify.Objectives.SingleAsync()).CurrentPercentage);
    }

    [Fact]
    public async Task Download_rejects_a_foreign_tenant_key_even_if_the_evidence_row_is_visible()
    {
        var f = await ArrangeAsync(); Guid evidenceId;
        await using (var db = f.Store.NewContext())
        {
            var update = ProgressUpdate.RecordPercentage(f.Store.TenantId, f.CycleId, f.ObjectiveId, f.OwnerId, 10m, EY.HRPlatform.Performance.Domain.Progress.ObjectiveStatus.OnTrack, null, false, false);
            var item = EvidenceItem.File(f.Store.TenantId, "proof.txt", "text/plain", 5, $"{Guid.NewGuid():N}/{Guid.NewGuid():N}.txt");
            evidenceId = item.Id; update.AttachEvidence(item);
            db.ProgressUpdates.Add(update); await db.SaveChangesAsync();
        }
        await using var read = f.Store.NewContext();
        var result = await new ResolveEvidenceFileHandler(read, f.Core).Handle(new(f.CycleId, evidenceId, new(f.OwnerId, false, false)), default);
        Assert.Equal("Evidence.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Download_rejects_closed_cycle_evidence_after_a_shortened_policy_before_cleanup()
    {
        var f = await ArrangeAsync();
        Guid evidenceId;
        await using (var db = f.Store.NewContext())
        {
            var cycle = await db.Cycles.SingleAsync(c => c.Id == f.CycleId);
            cycle.Close();
            db.Entry(cycle).Property(c => c.ClosedAt).CurrentValue = DateTime.UtcNow.AddMonths(-2);
            var settings = CycleSettings.CreateDefault(f.Store.TenantId);
            settings.Update(settings.DefaultMeasurementMethod, settings.SuggestedObjectiveCountMin,
                settings.SuggestedObjectiveCountMax, settings.PlanningDeadlineOffsetDays,
                settings.PlanAlignmentPolicy, evidenceRetentionMonths: 1);
            db.CycleSettings.Add(settings);

            var update = ProgressUpdate.RecordPercentage(f.Store.TenantId, f.CycleId, f.ObjectiveId, f.OwnerId, 10m, EY.HRPlatform.Performance.Domain.Progress.ObjectiveStatus.OnTrack, null, false, false);
            var key = $"{f.Store.TenantId:N}/{Guid.NewGuid():N}.txt";
            var item = EvidenceItem.File(f.Store.TenantId, "proof.txt", "text/plain", 5, key);
            evidenceId = item.Id;
            update.AttachEvidence(item);
            db.ProgressUpdates.Add(update);
            await db.SaveChangesAsync();
        }

        await using var read = f.Store.NewContext();
        var result = await new ResolveEvidenceFileHandler(read, f.Core)
            .Handle(new(f.CycleId, evidenceId, new(f.OwnerId, false, false)), default);
        Assert.Equal("Evidence.NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Local_store_rejects_foreign_and_traversal_keys_for_read_and_delete()
    {
        var tenant = Guid.NewGuid();
        var root = Path.Combine(Path.GetTempPath(), $"fusion-evidence-{Guid.NewGuid():N}");
        var store = new LocalPerformanceEvidenceStore(TestTenantContext.WithTenant(tenant), root);
        var key = await store.SaveAsync(new MemoryStream("proof"u8.ToArray()), "proof.txt", default);
        try
        {
            foreach (var invalid in new[] { $"{Guid.NewGuid():N}/{Guid.NewGuid():N}.txt", $"{tenant:N}/../outside.txt", $"{tenant:N}/..\\outside.txt" })
            {
                Assert.Null(await store.OpenAsync(invalid, default));
                await Assert.ThrowsAsync<ArgumentException>(() => store.DeleteAsync(invalid, default));
            }
            await using var valid = await store.OpenAsync(key, default);
            Assert.NotNull(valid);
        }
        finally
        {
            await store.DeleteAsync(key, default);
            Directory.Delete(Path.Combine(root, tenant.ToString("N")));
            Directory.Delete(root);
        }
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Upload_is_owner_only_even_for_an_administrator(bool admin)
    {
        var f = await ArrangeAsync();
        await using var db = f.Store.NewContext();
        var result = await new UploadEvidenceHandler(db, f.Files).Handle(new(f.CycleId, f.ObjectiveId,
            File("proof"u8.ToArray()), new(Guid.NewGuid(), admin, true)), default);
        Assert.Equal("Evidence.Forbidden", result.Error.Code); Assert.Empty(f.Files.Files);
    }

    [Fact]
    public async Task Uploaded_file_is_claimed_with_server_metadata_and_cannot_be_reused()
    {
        var f = await ArrangeAsync(); Guid uploadId;
        await using (var db = f.Store.NewContext())
        {
            var result = await new UploadEvidenceHandler(db, f.Files).Handle(new(f.CycleId, f.ObjectiveId,
                File("proof"u8.ToArray(), "folder/proof.txt"), new(f.OwnerId, false, false)), default);
            Assert.True(result.IsSuccess); uploadId = result.Value.UploadId;
            Assert.Equal("proof.txt", result.Value.FileName);
        }
        var request = new SubmitProgressRequest(30m, null, null, EY.HRPlatform.Performance.Domain.Progress.ObjectiveStatus.OnTrack, null, false,
            [new(EvidenceKind.File, uploadId, "forged.exe", "application/evil", -1, null, null, null)]);
        await using (var db = f.Store.NewContext())
        {
            var result = await new SubmitProgressHandler(db, f.Core, f.Store.Tenant, new TestPerformanceAudit(db), f.Files, new PerformanceNotifications(db))
                .Handle(new(f.CycleId, f.ObjectiveId, request, new(f.OwnerId, false, false)), default);
            Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : null);
        }
        await using (var db = f.Store.NewContext())
        {
            var result = await new SubmitProgressHandler(db, f.Core, f.Store.Tenant, new TestPerformanceAudit(db), f.Files, new PerformanceNotifications(db))
                .Handle(new(f.CycleId, f.ObjectiveId, request with { Percentage = 40m }, new(f.OwnerId, false, false)), default);
            Assert.Equal("Evidence.UploadInvalid", result.Error.Code);
        }
        await using var verify = f.Store.NewContext();
        Assert.NotNull((await verify.EvidenceUploads.SingleAsync()).ClaimedAt);
        Assert.Single(await verify.ProgressUpdates.ToListAsync());
        var item = await verify.EvidenceItems.SingleAsync();
        Assert.Equal("proof.txt", item.FileName); Assert.Equal("text/plain", item.ContentType); Assert.Equal(5L, item.SizeBytes);
        Assert.Equal(30m, (await verify.Objectives.SingleAsync()).CurrentPercentage);
    }

    [Theory]
    [InlineData("uploader")]
    [InlineData("objective")]
    [InlineData("cycle")]
    [InlineData("tenant")]
    [InlineData("claimed")]
    [InlineData("missing-file")]
    public async Task Foreign_or_unavailable_upload_cannot_be_attached_or_change_progress(string mismatch)
    {
        var f = await ArrangeAsync();
        var tenant = mismatch == "tenant" ? Guid.NewGuid() : f.Store.TenantId;
        var key = await f.Files.SaveAsync(new MemoryStream("proof"u8.ToArray()), "proof.txt", default);
        var upload = EvidenceUpload.Stage(tenant, mismatch == "cycle" ? Guid.NewGuid() : f.CycleId,
            mismatch == "objective" ? Guid.NewGuid() : f.ObjectiveId,
            mismatch == "uploader" ? Guid.NewGuid() : f.OwnerId, key, "proof.txt", "text/plain", 5);
        if (mismatch == "claimed") upload.Claim(f.ObjectiveId, f.OwnerId);
        if (mismatch == "missing-file") f.Files.Files.Clear();
        await using (var db = f.Store.NewContext(TestTenantContext.WithTenant(tenant)))
        { db.EvidenceUploads.Add(upload); await db.SaveChangesAsync(); }
        await using (var db = f.Store.NewContext())
        {
            var request = new SubmitProgressRequest(30m, null, null, EY.HRPlatform.Performance.Domain.Progress.ObjectiveStatus.OnTrack, null, false,
                [new(EvidenceKind.File, upload.Id, null, null, null, null, null, null)]);
            var result = await new SubmitProgressHandler(db, f.Core, f.Store.Tenant, new TestPerformanceAudit(db), f.Files, new PerformanceNotifications(db))
                .Handle(new(f.CycleId, f.ObjectiveId, request, new(f.OwnerId, false, false)), default);
            Assert.Equal("Evidence.UploadInvalid", result.Error.Code);
        }
        await using var verify = f.Store.NewContext();
        Assert.Empty(await verify.ProgressUpdates.ToListAsync()); Assert.Empty(await verify.EvidenceItems.ToListAsync());
        Assert.Null((await verify.Objectives.SingleAsync()).CurrentPercentage);
    }

    [Theory]
    [InlineData(".txt", "text/plain")]
    [InlineData(".csv", "text/csv")]
    [InlineData(".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")]
    [InlineData(".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    [InlineData(".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation")]
    public void Supported_document_types_are_accepted(string extension, string type)
        => Assert.Equal(type, EvidenceFileValidation.Validate("proof" + extension, type, "data"u8));

    [Fact]
    public void Supported_pdf_and_image_signatures_are_accepted()
    {
        Assert.Equal("application/pdf", EvidenceFileValidation.Validate("proof.pdf", "application/pdf", "%PDF-1.7"u8));
        Assert.Equal("image/png", EvidenceFileValidation.Validate("proof.png", "image/png", new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }));
        Assert.Equal("image/jpeg", EvidenceFileValidation.Validate("proof.jpeg", "image/jpeg", new byte[] { 255, 216, 255 }));
        Assert.Equal("image/gif", EvidenceFileValidation.Validate("proof.gif", "image/gif", "GIF89a"u8));
        Assert.Equal("image/webp", EvidenceFileValidation.Validate("proof.webp", "image/webp", "RIFFxxxxWEBP"u8));
    }
}

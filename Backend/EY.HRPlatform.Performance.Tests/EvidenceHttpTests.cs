using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Infrastructure.Evidence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace EY.HRPlatform.Performance.Tests;

public sealed class EvidenceHttpTests
{
    [Fact]
    public async Task Bound_upload_attaches_and_downloads_exact_bytes_without_exposing_storage_keys()
    {
        await using var factory = new PerformanceApiFactory();
        var owner = factory.Core.Add("Owner").EmployeeId;
        var start = new DateOnly(2026, 1, 1); var end = start.AddYears(1);
        var cycle = PerformanceCycle.CreateDraft(factory.Store.TenantId, "Evidence", start, end, start.AddDays(30)).Activated();
        var objective = Objective.CreateStrategic(factory.Store.TenantId, cycle.Id, "Evidence", null, owner, start, end,
            ObjectiveMeasurement.ManualPercentage(), start, end); objective.Publish();
        await using (var db = factory.Store.NewContext())
        { db.Cycles.Add(cycle); db.Objectives.Add(objective); await db.SaveChangesAsync(); }
        var files = new TestEvidenceStore(factory.Store.TenantId);
        using var host = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        { services.RemoveAll<IPerformanceEvidenceStore>(); services.AddSingleton<IPerformanceEvidenceStore>(files); }));
        using var client = host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", PerformanceTestJwt.Issue(
            factory.Store.TenantId, owner, [new(PerformancePermissions.CycleView, PermissionScopes.Self)], [ModuleEntitlements.Performance]));
        var route = $"/api/performance/cycles/{cycle.Id}/objectives/{objective.Id}";
        using var multipart = new MultipartFormDataContent();
        var content = new ByteArrayContent("evidence proof"u8.ToArray());
        content.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        multipart.Add(content, "file", "proof.txt");
        using var upload = await client.PostAsync(route + "/evidence/uploads", multipart);
        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        var body = await upload.Content.ReadAsStringAsync();
        Assert.DoesNotContain("storageKey", body);
        using var json = JsonDocument.Parse(body);
        var uploadId = json.RootElement.GetProperty("data").GetProperty("uploadId").GetGuid();
        using var submit = await client.PostAsJsonAsync(route + "/progress", new SubmitProgressRequest(20m, null, null, null, null, false,
            [new(EvidenceKind.File, uploadId, null, null, null, null, null, null)]));
        Assert.Equal(HttpStatusCode.OK, submit.StatusCode);
        await using var verify = factory.Store.NewContext();
        var item = await verify.EvidenceItems.SingleAsync();
        Assert.NotNull((await verify.EvidenceUploads.SingleAsync()).ClaimedAt);
        using var download = await client.GetAsync($"/api/performance/cycles/{cycle.Id}/evidence/{item.Id}");
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("text/plain", download.Content.Headers.ContentType!.MediaType);
        Assert.Equal("evidence proof"u8.ToArray(), await download.Content.ReadAsByteArrayAsync());
        using var oldRoute = await client.PostAsync($"/api/performance/cycles/{cycle.Id}/evidence/upload", new MultipartFormDataContent());
        Assert.Equal(HttpStatusCode.MethodNotAllowed, oldRoute.StatusCode);
    }
}

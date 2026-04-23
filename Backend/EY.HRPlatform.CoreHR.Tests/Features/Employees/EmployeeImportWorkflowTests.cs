using System.Text;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.CoreHR.Tests.Features.Employees;

public class EmployeeImportWorkflowTests
{
    private static readonly Guid TenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public async Task BuildTemplateAsync_ReturnsExactTemplateHeaders()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId));

        var template = await service.BuildTemplateAsync(CancellationToken.None);
        var csv = Encoding.UTF8.GetString(template.Content);

        Assert.Equal("employee-import-template.csv", template.FileName);
        Assert.Equal(
            "firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail\r\n",
            csv);
    }

    [Fact]
    public async Task UploadAsync_PersistsPreviewReadySessionWithNormalizedPreviewRows()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,SARAH.CHEN@CONTOSO.COM,2024-01-15,Senior Engineer,eng-platform,ALEX.MANAGER@CONTOSO.COM
            """);

        var session = await service.UploadAsync(file, CancellationToken.None);

        Assert.Equal(EmployeeImportStage.PreviewReady, session.Stage);
        Assert.Equal(1, session.SourceRowCount);
        Assert.Single(session.SampleRows);
        Assert.Single(session.PreviewRows);
        Assert.Equal("ENG-PLATFORM", session.PreviewRows[0].OrgUnitCode);
        Assert.Equal("sarah.chen@contoso.com", session.PreviewRows[0].Email);
        Assert.Equal("alex.manager@contoso.com", session.PreviewRows[0].ManagerEmail);

        var persistedSession = await context.EmployeeImportSessions.FindAsync(session.Id);
        Assert.NotNull(persistedSession);
    }

    [Fact]
    public async Task UploadAsync_RejectsUnexpectedHeaders()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId));
        var file = CreateCsvFile(
            "employees.csv",
            """
            first_name,last_name,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,alex.manager@contoso.com
            """);

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.UploadAsync(file, CancellationToken.None));

        Assert.Contains("official employee import template", exception.Message);
    }

    [Fact]
    public async Task UploadAsync_RejectsFileNamesLongerThanConfiguredLimit()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId));
        var file = CreateCsvFile(
            $"{new string('a', 257)}.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,alex.manager@contoso.com
            """);

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.UploadAsync(file, CancellationToken.None));

        Assert.Contains("260 characters or fewer", exception.Message);
    }

    [Fact]
    public async Task UploadAsync_RequiresSetupToBeComplete()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedActivatedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,alex.manager@contoso.com
            """);

        await Assert.ThrowsAsync<InvalidTenantSetupStateException>(() =>
            service.UploadAsync(file, CancellationToken.None));
    }

    [Fact]
    public async Task GetSessionAsync_MarksExpiredSessionsAndPersistsStage()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        Guid sessionId;
        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var session = EmployeeImportSession.CreatePreviewReady(
                TenantId,
                "employees.csv",
                128,
                "[]",
                "[]",
                "[]",
                DateTime.UtcNow.AddMinutes(-5));

            seedContext.EmployeeImportSessions.Add(session);
            await seedContext.SaveChangesAsync();
            sessionId = session.Id;
        }

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId));

        var sessionDto = await service.GetSessionAsync(sessionId, CancellationToken.None);

        Assert.Equal(EmployeeImportStage.Expired, sessionDto.Stage);

        await using var verificationContext = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var persistedSession = await verificationContext.EmployeeImportSessions.FindAsync(sessionId);
        Assert.NotNull(persistedSession);
        Assert.Equal(EmployeeImportStage.Expired, persistedSession!.Stage);
    }

    private static async Task SeedPublishedSetupAsync(string dbName)
    {
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var setupState = TenantSetupState.CreateActivated(TenantId);
        setupState.Approve(Guid.NewGuid(), "HR Admin", "HRAdmin", false);
        setupState.Publish();
        seedContext.TenantSetupStates.Add(setupState);
        await seedContext.SaveChangesAsync();
    }

    private static async Task SeedActivatedSetupAsync(string dbName)
    {
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
        await seedContext.SaveChangesAsync();
    }

    private static IFormFile CreateCsvFile(string fileName, string content)
    {
        var bytes = Encoding.UTF8.GetBytes(content.Replace("\r\n", "\n").Replace("\n", "\r\n"));
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = "text/csv"
        };
    }
}
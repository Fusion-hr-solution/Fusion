using System.Text;
using System.Text.Json;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Exceptions;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Dtos;
using EY.HRPlatform.CoreHR.Features.Employees.Import.Services;
using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

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
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));

        var template = await service.BuildTemplateAsync(CancellationToken.None);
        var csv = Encoding.UTF8.GetString(template.Content);

        Assert.Equal("employee-import-template.csv", template.FileName);
        Assert.Equal(
            "firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail\r\n",
            csv);
    }

    [Fact]
    public async Task GetSchemaAsync_UsesTenantRequirednessForJobTitle()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedTenantSettingsAsync(
            dbName,
            """
            {
                "employeeFieldConfig": {
                    "jobTitle": { "required": true },
                    "hireDate": { "required": false }
                }
            }
            """);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(
            context,
            TestTenantContext.WithTenant(TenantId),
            new EmployeeHierarchyService(context),
            new TenantSettingsReadService(context));

        var schema = await service.GetSchemaAsync(CancellationToken.None);

        Assert.True(schema.CanonicalFields.Single(field => field.Key == "jobTitle").Required);
        Assert.True(schema.CanonicalFields.Single(field => field.Key == "firstName").Required);
        Assert.True(schema.CanonicalFields.Single(field => field.Key == "hireDate").Required);
    }

    [Fact]
    public async Task UploadAsync_PersistsPreviewReadySessionWithNormalizedPreviewRows()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
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
    public async Task GetSessionAsync_ReturnsRequestedPreviewPage()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile("employees.csv", BuildEmployeeCsv(rowCount: 30));

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var secondPage = await service.GetSessionAsync(
            uploadedSession.Id,
            2,
            25,
            "all",
            null,
            CancellationToken.None);

        Assert.Equal(2, secondPage.PreviewPageNumber);
        Assert.Equal(25, secondPage.PreviewPageSize);
        Assert.Equal(2, secondPage.PreviewPageCount);
        Assert.Equal(30, secondPage.TotalPreviewRowCount);
        Assert.False(secondPage.HasMorePreviewRows);
        Assert.Equal([26, 27, 28, 29, 30], secondPage.PreviewRows.Select(row => row.RowNumber).ToArray());
    }

    [Fact]
    public async Task GetSessionAsync_UsesRequestedPreviewPageSize()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile("employees.csv", BuildEmployeeCsv(rowCount: 30));

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var secondPage = await service.GetSessionAsync(
            uploadedSession.Id,
            2,
            10,
            "all",
            null,
            CancellationToken.None);

        Assert.Equal(2, secondPage.PreviewPageNumber);
        Assert.Equal(10, secondPage.PreviewPageSize);
        Assert.Equal(3, secondPage.PreviewPageCount);
        Assert.Equal(30, secondPage.TotalPreviewRowCount);
        Assert.True(secondPage.HasMorePreviewRows);
        Assert.Equal([11, 12, 13, 14, 15, 16, 17, 18, 19, 20], secondPage.PreviewRows.Select(row => row.RowNumber).ToArray());
    }

    [Fact]
    public async Task GetSessionAsync_ClampsPreviewPageSizeToMinimum()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile("employees.csv", BuildEmployeeCsv(rowCount: 30));

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var normalizedPage = await service.GetSessionAsync(
            uploadedSession.Id,
            1,
            0,
            "all",
            null,
            CancellationToken.None);

        Assert.Equal(1, normalizedPage.PreviewPageNumber);
        Assert.Equal(1, normalizedPage.PreviewPageSize);
        Assert.Equal(30, normalizedPage.PreviewPageCount);
        Assert.True(normalizedPage.HasMorePreviewRows);
        Assert.Equal([1], normalizedPage.PreviewRows.Select(row => row.RowNumber).ToArray());
    }

    [Fact]
    public async Task GetSessionAsync_ClampsOutOfRangePreviewPagingInputs()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile("employees.csv", BuildEmployeeCsv(rowCount: 30));

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var normalizedPage = await service.GetSessionAsync(
            uploadedSession.Id,
            0,
            500,
            "all",
            null,
            CancellationToken.None);

        Assert.Equal(1, normalizedPage.PreviewPageNumber);
        Assert.Equal(100, normalizedPage.PreviewPageSize);
        Assert.Equal(1, normalizedPage.PreviewPageCount);
        Assert.False(normalizedPage.HasMorePreviewRows);
        Assert.Equal(Enumerable.Range(1, 30).ToArray(), normalizedPage.PreviewRows.Select(row => row.RowNumber).ToArray());
    }

    [Fact]
    public async Task UploadAsync_RejectsUnexpectedHeaders()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
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
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
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
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
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
    public async Task ValidateAsync_PersistsValidatedSession_WhenTenantReferencesResolve()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");
        await SeedEmployeeAsync(dbName, "alex.manager@contoso.com");

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,eng-platform,alex.manager@contoso.com
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var validatedSession = await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);

        Assert.Equal(EmployeeImportStage.Validated, validatedSession.Stage);
        Assert.Equal(1, validatedSession.ValidationSummary.TotalRows);
        Assert.Equal(1, validatedSession.ValidationSummary.ValidRows);
        Assert.Equal(0, validatedSession.ValidationSummary.ErrorCount);
        Assert.Empty(validatedSession.ValidationIssues);

        var persistedSession = await context.EmployeeImportSessions.FindAsync(uploadedSession.Id);
        Assert.NotNull(persistedSession);
        Assert.False(string.IsNullOrWhiteSpace(persistedSession!.NormalizedRowsJson));
        Assert.False(string.IsNullOrWhiteSpace(persistedSession.ValidationIssuesJson));
    }

    [Fact]
    public async Task ValidateAsync_ResolvesManagersWithinSameUploadedBatch()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Alex,Manager,alex.manager@contoso.com,2024-01-15,Engineering Manager,ENG-PLATFORM,
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,alex.manager@contoso.com
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var validatedSession = await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);

        Assert.Equal(EmployeeImportStage.Validated, validatedSession.Stage);
        Assert.Equal(2, validatedSession.ValidationSummary.ValidRows);
        Assert.Empty(validatedSession.ValidationIssues);
    }

    [Fact]
    public async Task ApplyAsync_CreatesEmployeesMarksSessionAppliedAndReturnsResult()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var actor = CreateActor();
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);

        var result = await service.ApplyAsync(uploadedSession.Id, actor, CancellationToken.None);

        Assert.Equal(EmployeeImportStage.Applied, result.Stage);
        Assert.Equal(uploadedSession.Id, result.SessionId);
        Assert.Equal(1, result.CreatedCount);
        Assert.Equal(1, result.ValidRowCount);
        Assert.NotEqual(Guid.Empty, result.HistoryId);

        var employee = await context.Employees.SingleAsync();
        Assert.Equal("sarah.chen@contoso.com", employee.Email);
        Assert.NotNull(employee.OrgUnitId);

        var persistedSession = await context.EmployeeImportSessions.FindAsync(uploadedSession.Id);
        Assert.NotNull(persistedSession);
        Assert.Equal(EmployeeImportStage.Applied, persistedSession!.Stage);
        Assert.NotNull(persistedSession.AppliedAt);
    }

    [Fact]
    public async Task ApplyAsync_IsBlockedWhenSessionHasNotBeenValidated()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ApplyAsync(uploadedSession.Id, CreateActor(), CancellationToken.None));

        Assert.Contains("Validate the import before applying it", exception.Message);
    }

    [Fact]
    public async Task ApplyAsync_IsBlockedWhenValidationErrorsExist()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,UNKNOWN,
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ApplyAsync(uploadedSession.Id, CreateActor(), CancellationToken.None));

        Assert.Contains("validation errors", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApplyAsync_IsBlockedWhenSessionExpired()
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
            session.SetValidationResult("[]", "[]");

            seedContext.EmployeeImportSessions.Add(session);
            await seedContext.SaveChangesAsync();
            sessionId = session.Id;
        }

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ApplyAsync(sessionId, CreateActor(), CancellationToken.None));

        Assert.Contains("Upload expired", exception.Message);
    }

    [Fact]
    public async Task ApplyAsync_IsAtomicWhenFailureOccursBeforeSave()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ApplyAsync(
                uploadedSession.Id,
                new EmployeeImportActorDto(Guid.Empty, "HR Admin", "HRAdmin"),
                CancellationToken.None));

        Assert.Empty(context.Employees);
        Assert.Empty(context.EmployeeImportHistories);

        var persistedSession = await context.EmployeeImportSessions.FindAsync(uploadedSession.Id);
        Assert.NotNull(persistedSession);
        Assert.Equal(EmployeeImportStage.Validated, persistedSession!.Stage);
        Assert.Null(persistedSession.AppliedAt);
    }

    [Fact]
    public async Task ApplyAsync_RechecksTenantDuplicateEmailsBeforeWriting()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");

        Guid uploadedSessionId;
        await using (var validateContext = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName))
        {
            var validateService = new EmployeeImportWorkflowService(validateContext, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(validateContext));
            var file = CreateCsvFile(
                "employees.csv",
                """
                firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
                Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,
                """);

            var uploadedSession = await validateService.UploadAsync(file, CancellationToken.None);
            await validateService.ValidateAsync(uploadedSession.Id, CancellationToken.None);
            uploadedSessionId = uploadedSession.Id;
        }

        await SeedEmployeeAsync(dbName, "sarah.chen@contoso.com");

        await using var applyContext = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var applyService = new EmployeeImportWorkflowService(applyContext, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(applyContext));

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            applyService.ApplyAsync(uploadedSessionId, CreateActor(), CancellationToken.None));

        Assert.Contains("Validate the file again before applying", exception.Message);
        Assert.Single(applyContext.Employees);
        Assert.Empty(applyContext.EmployeeImportHistories);
    }

    [Fact]
    public async Task ApplyAsync_AssignsManagersForSameFileReferences()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Alex,Manager,alex.manager@contoso.com,2024-01-15,Engineering Manager,ENG-PLATFORM,
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,alex.manager@contoso.com
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);
        await service.ApplyAsync(uploadedSession.Id, CreateActor(), CancellationToken.None);

        var employees = await context.Employees
            .OrderBy(employee => employee.Email)
            .ToListAsync();

        var manager = Assert.Single(employees, employee => employee.Email == "alex.manager@contoso.com");
        var report = Assert.Single(employees, employee => employee.Email == "sarah.chen@contoso.com");

        Assert.Equal(manager.Id, report.ManagerId);
    }

    [Fact]
    public async Task ApplyAsync_BlocksTamperedValidatedSessionWhenManagerCycleWouldBeCreated()
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
                JsonSerializer.Serialize(new[] { "firstName", "lastName", "email", "hireDate", "jobTitle", "orgUnitCode", "managerEmail" }),
                JsonSerializer.Serialize(new object[]
                {
                    new { rowNumber = 1, values = new Dictionary<string, string?>() },
                    new { rowNumber = 2, values = new Dictionary<string, string?>() },
                }),
                "[]",
                DateTime.UtcNow.AddHours(1));

            session.SetValidationResult(
                JsonSerializer.Serialize(new object[]
                {
                    new
                    {
                        rowNumber = 1,
                        firstName = "Alex",
                        lastName = "Manager",
                        email = "alex.manager@contoso.com",
                        hireDate = DateTime.SpecifyKind(new DateTime(2024, 1, 15), DateTimeKind.Utc),
                        jobTitle = "Engineering Manager",
                        orgUnitCode = (string?)null,
                        orgUnitId = (Guid?)null,
                        managerEmail = "sarah.chen@contoso.com",
                        existingManagerId = (Guid?)null,
                    },
                    new
                    {
                        rowNumber = 2,
                        firstName = "Sarah",
                        lastName = "Chen",
                        email = "sarah.chen@contoso.com",
                        hireDate = DateTime.SpecifyKind(new DateTime(2024, 1, 15), DateTimeKind.Utc),
                        jobTitle = "Senior Engineer",
                        orgUnitCode = (string?)null,
                        orgUnitId = (Guid?)null,
                        managerEmail = "alex.manager@contoso.com",
                        existingManagerId = (Guid?)null,
                    },
                }),
                "[]");

            seedContext.EmployeeImportSessions.Add(session);
            await seedContext.SaveChangesAsync();
            sessionId = session.Id;
        }

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));

        var exception = await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ApplyAsync(sessionId, CreateActor(), CancellationToken.None));

        Assert.Contains("cycle", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(context.Employees);
        Assert.Empty(context.EmployeeImportHistories);

        var persistedSession = await context.EmployeeImportSessions.FindAsync(sessionId);
        Assert.NotNull(persistedSession);
        Assert.Equal(EmployeeImportStage.Validated, persistedSession!.Stage);
        Assert.Null(persistedSession.AppliedAt);
    }

    [Fact]
    public async Task ApplyAsync_WritesHistoryWithActorMetadata()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");

        var actor = new EmployeeImportActorDto(
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            "HR Admin",
            "HRAdmin");

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);
        await service.ApplyAsync(uploadedSession.Id, actor, CancellationToken.None);

        var history = await context.EmployeeImportHistories.SingleAsync();

        Assert.Equal(uploadedSession.Id, history.SessionId);
        Assert.Equal("employees.csv", history.SourceFileName);
        Assert.Equal(1, history.SourceRowCount);
        Assert.Equal(1, history.ValidRowCount);
        Assert.Equal(1, history.CreatedCount);
        Assert.Equal(0, history.SkippedCount);
        Assert.Equal("Applied", history.Status);
        Assert.Equal(actor.UserId, history.ActorUserId);
        Assert.Equal(actor.FullName, history.ActorFullName);
        Assert.Equal(actor.Role, history.ActorRole);
    }

    [Fact]
    public async Task HistoryQueries_AreTenantScopedAndOrderedNewestFirst()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);

        var oldestHistoryId = await SeedAppliedHistoryAsync(
            dbName,
            TenantId,
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            "employees-old.csv",
            DateTime.UtcNow.AddMinutes(-20));
        var newestHistoryId = await SeedAppliedHistoryAsync(
            dbName,
            TenantId,
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            "employees-new.csv",
            DateTime.UtcNow.AddMinutes(-5));
        await SeedAppliedHistoryAsync(
            dbName,
            Guid.Parse("33333333-3333-3333-3333-333333333333"),
            Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            "employees-other-tenant.csv",
            DateTime.UtcNow.AddMinutes(-1));

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));

        var page = await service.GetHistoryAsync(1, 10, CancellationToken.None);

        Assert.Equal(2, page.TotalCount);
        Assert.Equal([newestHistoryId, oldestHistoryId], page.Items.Select(item => item.Id).ToArray());

        var detail = await service.GetHistoryDetailAsync(newestHistoryId, CancellationToken.None);

        Assert.Equal("employees-new.csv", detail.SourceFileName);

        await Assert.ThrowsAsync<EntityNotFoundException>(() =>
            service.GetHistoryDetailAsync(
                Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                CancellationToken.None));
    }

    [Fact]
    public async Task ValidateAsync_ReturnsIssuesForDuplicateTenantEmailAndInactiveOrgUnit()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedInactiveOrgUnitAsync(dbName, "ENG-PLATFORM");
        await SeedEmployeeAsync(dbName, "sarah.chen@contoso.com");

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var validatedSession = await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);

        Assert.Equal(EmployeeImportStage.Validated, validatedSession.Stage);
        Assert.Equal(0, validatedSession.ValidationSummary.ValidRows);
        var duplicateEmailIssue = Assert.Single(
            validatedSession.ValidationIssues,
            issue => issue.Code == "duplicateEmailInTenant");
        Assert.Equal("duplicateIdentity", duplicateEmailIssue.Category);
        Assert.Equal("duplicateEmailInTenant:sarah.chen@contoso.com", duplicateEmailIssue.GroupKey);
        Assert.Equal("sarah.chen@contoso.com", duplicateEmailIssue.Value);
        Assert.Equal(
            "Use a different email for this new employee or remove the row from the import.",
            duplicateEmailIssue.FixHint);

        var orgUnitIssue = Assert.Single(
            validatedSession.ValidationIssues,
            issue => issue.Code == "orgUnitInactive");
        Assert.Equal("invalidStructureReference", orgUnitIssue.Category);
        Assert.Equal("orgUnitInactive:ENG-PLATFORM", orgUnitIssue.GroupKey);
        Assert.Equal("ENG-PLATFORM", orgUnitIssue.Value);
        Assert.Equal(
            "Replace this with an active org unit code that already exists in the tenant.",
            orgUnitIssue.FixHint);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsMissingJobTitle_WhenTenantSettingsRequireIt()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedTenantSettingsAsync(
            dbName,
            """
            {
                "employeeFieldConfig": {
                    "jobTitle": { "required": true }
                }
            }
            """);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(
            context,
            TestTenantContext.WithTenant(TenantId),
            new EmployeeHierarchyService(context),
            new TenantSettingsReadService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,,ENG-PLATFORM,
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var validatedSession = await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);

        var issue = Assert.Single(validatedSession.ValidationIssues, current => current.Code == "missingJobTitle");
        Assert.Equal("missingRequiredData", issue.Category);
        Assert.Equal("jobTitle", issue.Field);
        Assert.Equal("Add a job title for this row.", issue.FixHint);
        Assert.True(validatedSession.EmployeeImportSchema.CanonicalFields.Single(field => field.Key == "jobTitle").Required);
        Assert.Equal(0, validatedSession.ValidationSummary.ValidRows);
    }

    [Fact]
    public async Task ValidateAsync_StillRequiresHireDate_WhenStoredOverrideMarksItOptional()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedTenantSettingsAsync(
            dbName,
            """
            {
                "employeeFieldConfig": {
                    "hireDate": { "required": false }
                }
            }
            """);

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(
            context,
            TestTenantContext.WithTenant(TenantId),
            new EmployeeHierarchyService(context),
            new TenantSettingsReadService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,,Senior Engineer,,
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var validatedSession = await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);

        var issue = Assert.Single(validatedSession.ValidationIssues, current => current.Code == "missingHireDate");
        Assert.Equal("missingRequiredData", issue.Category);
        Assert.True(validatedSession.EmployeeImportSchema.CanonicalFields.Single(field => field.Key == "hireDate").Required);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsErrorsForManagerSelfReference()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,sarah.chen@contoso.com
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var validatedSession = await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);

        Assert.Contains(validatedSession.ValidationIssues, issue => issue.Code == "selfManager");
    }

    [Fact]
    public async Task ValidateAsync_ReturnsErrorsForInactiveManager()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");

        await using (var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName))
        {
            var inactiveManager = Employee.Create(
                TenantId,
                "Inactive",
                "Manager",
                "inactive.manager@contoso.com",
                DateTime.SpecifyKind(new DateTime(2024, 1, 15), DateTimeKind.Utc),
                null,
                "Engineering Manager");
            inactiveManager.Deactivate();
            seedContext.Employees.Add(inactiveManager);
            await seedContext.SaveChangesAsync();
        }

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,inactive.manager@contoso.com
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var validatedSession = await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);

        var issue = Assert.Single(validatedSession.ValidationIssues, current => current.Code == "managerInactive");
        Assert.Equal("invalidReportingReference", issue.Category);
        Assert.Equal("inactive.manager@contoso.com", issue.Value);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsErrorsForSameFileManagerCycles()
    {
        var dbName = Guid.NewGuid().ToString();
        await SeedPublishedSetupAsync(dbName);
        await SeedOrgUnitAsync(dbName, "ENG-PLATFORM");

        await using var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(TenantId), dbName);
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));
        var file = CreateCsvFile(
            "employees.csv",
            """
            firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail
            Alex,Manager,alex.manager@contoso.com,2024-01-15,Engineering Manager,ENG-PLATFORM,sarah.chen@contoso.com
            Sarah,Chen,sarah.chen@contoso.com,2024-01-15,Senior Engineer,ENG-PLATFORM,alex.manager@contoso.com
            """);

        var uploadedSession = await service.UploadAsync(file, CancellationToken.None);
        var validatedSession = await service.ValidateAsync(uploadedSession.Id, CancellationToken.None);

        Assert.Equal(EmployeeImportStage.Validated, validatedSession.Stage);
        Assert.Contains(validatedSession.ValidationIssues, issue => issue.RowNumber == 1 && issue.Code == "managerCycle");
        Assert.Contains(validatedSession.ValidationIssues, issue => issue.RowNumber == 2 && issue.Code == "managerCycle");
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
        var service = new EmployeeImportWorkflowService(context, TestTenantContext.WithTenant(TenantId), new EmployeeHierarchyService(context));

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

    private static async Task SeedTenantSettingsAsync(string dbName, string overridesJson)
    {
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        seedContext.TenantSettings.Add(EY.HRPlatform.CoreHR.Domain.Entities.TenantSettings.Create(TenantId, overridesJson));
        await seedContext.SaveChangesAsync();
    }

    private static async Task SeedActivatedSetupAsync(string dbName)
    {
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        seedContext.TenantSetupStates.Add(TenantSetupState.CreateActivated(TenantId));
        await seedContext.SaveChangesAsync();
    }

    private static async Task SeedEmployeeAsync(string dbName, string email)
    {
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        seedContext.Employees.Add(Employee.Create(
            TenantId,
            "Alex",
            "Manager",
            email,
            DateTime.SpecifyKind(new DateTime(2024, 1, 15), DateTimeKind.Utc),
            null,
            "Engineering Manager"));
        await seedContext.SaveChangesAsync();
    }

    private static async Task SeedOrgUnitAsync(string dbName, string code)
    {
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        seedContext.OrgUnits.Add(OrgUnit.Create(TenantId, code, "Engineering Platform", "Department", null));
        await seedContext.SaveChangesAsync();
    }

    private static async Task SeedInactiveOrgUnitAsync(string dbName, string code)
    {
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var orgUnit = OrgUnit.Create(TenantId, code, "Engineering Platform", "Department", null);
        orgUnit.Deactivate();
        seedContext.OrgUnits.Add(orgUnit);
        await seedContext.SaveChangesAsync();
    }

    private static async Task<Guid> SeedAppliedHistoryAsync(
        string dbName,
        Guid tenantId,
        Guid sessionId,
        string sourceFileName,
        DateTime appliedAtUtc)
    {
        await using var seedContext = TestDbContextFactory.CreateWithoutTenant(dbName);
        var history = EmployeeImportHistory.CreateApplied(
            tenantId,
            sessionId,
            sourceFileName,
            128,
            4,
            4,
            4,
            0,
            appliedAtUtc,
            Guid.Parse("44444444-4444-4444-4444-444444444444"),
            "HR Admin",
            "HRAdmin");

        seedContext.EmployeeImportHistories.Add(history);
        await seedContext.SaveChangesAsync();

        return history.Id;
    }

    private static EmployeeImportActorDto CreateActor()
        => new(
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            "HR Admin",
            "HRAdmin");

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

    private static string BuildEmployeeCsv(int rowCount)
    {
        var rows = Enumerable.Range(1, rowCount)
            .Select(index =>
                $"First{index},Last{index},employee{index}@contoso.com,2024-01-15,Engineer,ENG-PLATFORM,manager{index}@contoso.com");

        return string.Join(
            Environment.NewLine,
            [
                "firstName,lastName,email,hireDate,jobTitle,orgUnitCode,managerEmail",
                .. rows,
            ]);
    }
}
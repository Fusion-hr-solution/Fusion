using System.Security.Claims;
using System.Text.Json;
using EY.HRPlatform.CoreHR.Controllers;
using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.OrgChart;
using EY.HRPlatform.CoreHR.Features.Security;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;
using EY.HRPlatform.CoreHR.Features.TenantSettings.Services;
using EY.HRPlatform.CoreHR.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Api;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace EY.HRPlatform.CoreHR.Tests.Features.OrgChart;

/// <summary>
/// B-094: the people org chart read model. Everyone with Tenant scope sees the whole tenant; DirectReports scope
/// sees its own chain and branch with the rest folded into counts; another date than today is HR only; the
/// tenant's field audiences apply; nothing crosses tenants.
/// </summary>
public sealed class OrgChartTests
{
    private static readonly Guid TenantA = Guid.NewGuid();
    private static readonly Guid TenantB = Guid.NewGuid();
    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);
    private static readonly DateTime TodayAt = Today.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

    private sealed record World(string Db, Dictionary<string, Guid> Ids, Dictionary<string, string> Keys, Guid Outsider);

    /// <summary>
    /// Tenant A: Sami (CEO, in the organization root) → Amira → Mariam → Aicha (hired 30 days ago);
    /// Amira → Omar → Leila (dotted line to Mariam); Sami → Nour → Mehdi. Everyone but Sami works in Product A,
    /// a team under the Product &amp; Engineering business unit, whose Fusion timeline starts 90 days ago. Coming up:
    /// Leila moves from Omar to Nour in 10 days, Skander joins Mariam in 20, Omar's last day is in 39.
    /// Tenant B holds one person.
    /// </summary>
    private static async Task<World> SeedAsync()
    {
        var db = Guid.NewGuid().ToString();
        await using var seed = TestDbContextFactory.CreateWithoutTenant(db);
        var since = Today.AddDays(-90);

        OrgUnit Unit(Guid tenant, string name, OrgUnit? parent)
        {
            var unit = OrgUnit.Create(tenant, $"U-{Guid.NewGuid():N}"[..10], name, "Department", parent?.Id);
            seed.OrgUnits.Add(unit);
            seed.OrgUnitEffectiveStates.Add(OrgUnitEffectiveState.Create(tenant, unit.Id, OrganizationalUnitTypeCatalog.DepartmentId,
                parent?.Id, name, OrgUnitLifecycleState.Active, since));
            return unit;
        }

        var root = Unit(TenantA, "Carthage", null);
        var bu = Unit(TenantA, "Product & Engineering", root);
        var team = Unit(TenantA, "Product A", bu);
        var rootB = Unit(TenantB, "Borealis", null);

        var ids = new Dictionary<string, Guid>();
        var keys = new Dictionary<string, string>();
        var assignments = new Dictionary<Guid, Guid>();
        var employments = new Dictionary<Guid, Employment>();
        Guid Person(Guid tenant, string first, string last, string title, OrgUnit unit, DateTime start)
        {
            var employee = Employee.Create(tenant, first, last, $"{first.ToLowerInvariant()}@example.com", employeeNumber: $"E-{Guid.NewGuid():N}");
            var employment = Employment.Start(tenant, employee.Id, start, "FullTime", WorkforceSourceType.Manual);
            var assignment = WorkAssignment.Create(tenant, employment.Id, employee.Id, unit.Id, title, "Tunis", true, start, null, WorkforceSourceType.Manual);
            seed.Employees.Add(employee);
            seed.Employments.Add(employment);
            seed.WorkAssignments.Add(assignment);
            assignments[employee.Id] = assignment.Id;
            employments[employee.Id] = employment;
            ids[first] = employee.Id;
            keys[first] = employee.StableEmployeeKey;
            return employee.Id;
        }

        ManagerRelationship Reports(string subject, string manager, ReportingRelationshipType type = ReportingRelationshipType.PrimaryManager, int fromDay = -30)
        {
            var relationship = ManagerRelationship.Create(TenantA, ids[subject], ids[manager],
                assignments[ids[subject]], assignments[ids[manager]], type, TodayAt.AddDays(fromDay), WorkforceSourceType.Manual);
            seed.ManagerRelationships.Add(relationship);
            return relationship;
        }

        var long_ago = TodayAt.AddYears(-3);
        Person(TenantA, "Sami", "Ben Youssef", "Chief Executive Officer", root, long_ago);
        foreach (var (first, last, title) in new[]
                 {
                     ("Amira", "Khelifi", "CTO"), ("Mariam", "Gharbi", "VP, Product"), ("Omar", "Mansour", "VP, Engineering"),
                     ("Leila", "Baccouche", "Project Manager"), ("Nour", "Ben Ali", "CPO"), ("Mehdi", "Kacem", "VP, People"),
                 })
            Person(TenantA, first, last, title, team, long_ago);
        Person(TenantA, "Aicha", "Bouazizi", "QA Engineer", team, TodayAt.AddDays(-30));
        var outsider = Person(TenantB, "Zed", "Outsider", "Advisor", rootB, long_ago);

        Reports("Amira", "Sami");
        Reports("Nour", "Sami");
        Reports("Mariam", "Amira");
        Reports("Omar", "Amira");
        Reports("Aicha", "Mariam");
        Reports("Leila", "Omar").End(TodayAt.AddDays(10));
        Reports("Leila", "Nour", fromDay: 10);
        Reports("Leila", "Mariam", ReportingRelationshipType.SecondaryManager);
        Reports("Mehdi", "Nour");
        Person(TenantA, "Skander", "Mejri", "Product Designer", team, TodayAt.AddDays(20));
        Reports("Skander", "Mariam", fromDay: 20);
        employments[ids["Omar"]].End(TodayAt.AddDays(40));
        await seed.SaveChangesAsync();
        return new World(db, ids, keys, outsider);
    }

    private static async Task<OrgChartDto> ReadAsync(
        World world, string scope, Guid? viewer, bool hr = false, DateOnly? asOf = null, Guid? tenant = null, TenantSettingsDto? settings = null)
    {
        var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenant ?? TenantA), world.Db);
        var tenantSettings = new Mock<ITenantSettingsReadService>();
        tenantSettings.Setup(s => s.GetCurrentAsync(It.IsAny<CancellationToken>())).ReturnsAsync(settings ?? new TenantSettingsDto());
        var result = await new OrgChartQueryHandler(context, tenantSettings.Object)
            .Handle(new OrgChartQuery(asOf ?? Today, scope, viewer, hr), default);
        Assert.True(result.IsSuccess);
        return result.Value;
    }

    private static OrgChartPersonDto Get(OrgChartDto chart, World world, string first)
        => Assert.Single(chart.People, p => p.EmployeeKey == world.Keys[first]);

    [Fact]
    public async Task Tenant_scope_sees_everyone_in_the_tenant_with_counts_divisions_and_dotted_lines()
    {
        var world = await SeedAsync();
        var chart = await ReadAsync(world, OrgChartScopes.Tenant, world.Ids["Aicha"]);

        Assert.Equal(8, chart.People.Count);
        Assert.Empty(chart.Folded);
        Assert.Equal(world.Keys["Aicha"], chart.ViewerKey);

        var sami = Get(chart, world, "Sami");
        Assert.Equal((2, 7, null), (sami.DirectCount, sami.TotalCount, sami.ManagerKey));
        Assert.Null(sami.Unit!.DivisionId); // the organization root has no division

        var aicha = Get(chart, world, "Aicha");
        Assert.Equal(("AB", "QA Engineer", "Tunis", "aicha@example.com"), (aicha.Initials, aicha.JobTitle, aicha.WorkLocation, aicha.WorkEmail));
        Assert.Equal(("Product A", "Product & Engineering"), (aicha.Unit!.Name, aicha.Unit.DivisionName));
        Assert.Equal(world.Keys["Mariam"], aicha.ManagerKey);
        Assert.True(aicha.IsNew);
        Assert.False(Get(chart, world, "Mariam").IsNew);

        Assert.Equal([world.Keys["Mariam"]], Get(chart, world, "Leila").DottedLineManagerKeys);
    }

    [Fact]
    public async Task Direct_reports_scope_sees_its_chain_and_branch_and_only_counts_the_rest()
    {
        var world = await SeedAsync();
        var chart = await ReadAsync(world, OrgChartScopes.DirectReports, world.Ids["Mariam"]);

        Assert.Equal(["Aicha", "Amira", "Mariam", "Sami"], chart.People.Select(p => p.DisplayName.Split(' ')[0]).Order());
        // Omar's branch (2) folds under Amira, Nour's (2) under Sami; nobody's name or key leaks.
        Assert.Equal(
            [(world.Keys["Amira"], 2), (world.Keys["Sami"], 2)],
            chart.Folded.Select(f => (f.ParentKey, f.Count)).OrderBy(f => f.ParentKey == world.Keys["Sami"]));
        // Counts stay whole-tenant; the dotted line to a hidden person is not drawn.
        Assert.Equal((2, 4), (Get(chart, world, "Amira").DirectCount, Get(chart, world, "Amira").TotalCount));
        Assert.DoesNotContain(chart.People, p => p.EmployeeKey == world.Keys["Leila"]);
    }

    [Fact]
    public async Task Direct_reports_scope_without_an_employee_record_sees_nobody()
    {
        var world = await SeedAsync();
        var chart = await ReadAsync(world, OrgChartScopes.DirectReports, viewer: null);
        Assert.Empty(chart.People);
        Assert.Empty(chart.Folded);
    }

    [Fact]
    public async Task Nothing_crosses_tenants()
    {
        var world = await SeedAsync();
        var inB = await ReadAsync(world, OrgChartScopes.Tenant, world.Outsider, tenant: TenantB);
        Assert.Equal(["Zed Outsider"], inB.People.Select(p => p.DisplayName));

        // Tenant B's employee presented in tenant A is nobody there.
        var foreign = await ReadAsync(world, OrgChartScopes.DirectReports, world.Outsider);
        Assert.Empty(foreign.People);
        Assert.Null(foreign.ViewerKey);
        Assert.DoesNotContain((await ReadAsync(world, OrgChartScopes.Tenant, world.Ids["Aicha"])).People, p => p.DisplayName == "Zed Outsider");
    }

    [Fact]
    public async Task A_past_date_shows_the_company_as_it_was()
    {
        var world = await SeedAsync();
        var chart = await ReadAsync(world, OrgChartScopes.Tenant, world.Ids["Amira"], hr: true, asOf: Today.AddDays(-60));

        Assert.DoesNotContain(chart.People, p => p.EmployeeKey == world.Keys["Aicha"]); // not hired yet
        Assert.All(chart.People, p => Assert.Null(p.ManagerKey)); // reporting lines start 30 days ago
        Assert.Equal(Today.AddDays(-60), chart.AsOf);

        // Before the units' Fusion timeline starts, they read as their first state rather than vanish.
        var earlier = await ReadAsync(world, OrgChartScopes.Tenant, null, hr: true, asOf: Today.AddDays(-365));
        Assert.Equal(("Product A", "Product & Engineering"), (Get(earlier, world, "Mariam").Unit!.Name, Get(earlier, world, "Mariam").Unit!.DivisionName));
    }

    [Fact]
    public async Task A_future_date_shows_planned_joins_moves_and_exits()
    {
        var world = await SeedAsync();
        var chart = await ReadAsync(world, OrgChartScopes.Tenant, null, hr: true, asOf: Today.AddDays(45));

        Assert.Equal(world.Keys["Mariam"], Get(chart, world, "Skander").ManagerKey);
        Assert.Equal(world.Keys["Nour"], Get(chart, world, "Leila").ManagerKey);
        Assert.DoesNotContain(chart.People, p => p.EmployeeKey == world.Keys["Omar"]);
    }

    [Fact]
    public async Task Only_HR_gets_the_full_start_date()
    {
        var world = await SeedAsync();
        Assert.All((await ReadAsync(world, OrgChartScopes.Tenant, world.Ids["Aicha"])).People, p => Assert.Null(p.StartDate));
        Assert.Equal(Today.AddDays(-30), Get(await ReadAsync(world, OrgChartScopes.Tenant, world.Ids["Nour"], hr: true), world, "Aicha").StartDate);
    }

    // ── Changes over a window ───────────────────────────────────────────────

    private static async Task<IReadOnlyList<OrgChartChangeDto>> ChangesAsync(World world, DateOnly from, DateOnly to, Guid? tenant = null)
    {
        var context = TestDbContextFactory.Create(TestTenantContext.WithTenant(tenant ?? TenantA), world.Db);
        var tenantSettings = new Mock<ITenantSettingsReadService>();
        tenantSettings.Setup(s => s.GetCurrentAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new TenantSettingsDto());
        var result = await new OrgChartChangesQueryHandler(context, tenantSettings.Object).Handle(new OrgChartChangesQuery(from, to), default);
        Assert.True(result.IsSuccess);
        return result.Value;
    }

    [Fact]
    public async Task Changes_list_joins_moves_and_leavers_in_the_window()
    {
        var world = await SeedAsync();
        var changes = await ChangesAsync(world, Today.AddDays(1), Today.AddDays(60));

        Assert.Equal(
            [
                (OrgChartChangeKinds.Move, Today.AddDays(10), world.Keys["Leila"], (string?)world.Keys["Nour"]),
                (OrgChartChangeKinds.Join, Today.AddDays(20), world.Keys["Skander"], world.Keys["Mariam"]),
                (OrgChartChangeKinds.Leave, Today.AddDays(39), world.Keys["Omar"], null),
            ],
            changes.Select(c => (c.Kind, c.Date, c.EmployeeKey, c.ManagerKey)));
        var joiner = changes[1].Person!;
        Assert.Equal(("Skander Mejri", "Product Designer", "Product A"), (joiner.DisplayName, joiner.JobTitle, joiner.Unit!.Name));
        Assert.Null(changes[0].Person);

        // Both ends count; a first manager on the first day belongs to the join.
        var past = await ChangesAsync(world, Today.AddDays(-30), Today.AddDays(-30));
        Assert.Equal([(OrgChartChangeKinds.Join, world.Keys["Aicha"])], past.Select(c => (c.Kind, c.EmployeeKey)));
        Assert.Empty(await ChangesAsync(world, Today.AddDays(40), Today.AddDays(60)));
        Assert.Empty(await ChangesAsync(world, Today.AddDays(1), Today.AddDays(60), tenant: TenantB));
    }

    /// <summary>
    /// B-135: joiner cards are built in one pass, not from one chart per join day. Many join days, some shared, joiners
    /// who manage on day one, dotted lines, a manager gone before their report starts, a unit renamed mid-window, a
    /// rehire and a renewal: every joiner card equals that person's card in the chart HR reads for that day.
    /// </summary>
    [Fact]
    public async Task Joiner_cards_match_the_chart_on_each_join_day()
    {
        var db = Guid.NewGuid().ToString();
        await using (var seed = TestDbContextFactory.CreateWithoutTenant(db))
        {
            var random = new Random(135);
            var longAgo = TodayAt.AddYears(-3);
            var root = OrgUnit.Create(TenantA, "U-root", "Carthage", "Department", null);
            var team = OrgUnit.Create(TenantA, "U-team", "Product A", "Department", root.Id);
            seed.OrgUnits.AddRange(root, team);
            seed.OrgUnitEffectiveStates.Add(OrgUnitEffectiveState.Create(TenantA, root.Id, OrganizationalUnitTypeCatalog.DepartmentId,
                null, "Carthage", OrgUnitLifecycleState.Active, DateOnly.FromDateTime(longAgo)));
            seed.OrgUnitEffectiveStates.Add(OrgUnitEffectiveState.Create(TenantA, team.Id, OrganizationalUnitTypeCatalog.DepartmentId,
                root.Id, "Product A", OrgUnitLifecycleState.Active, DateOnly.FromDateTime(longAgo), Today.AddDays(-50)));
            seed.OrgUnitEffectiveStates.Add(OrgUnitEffectiveState.Create(TenantA, team.Id, OrganizationalUnitTypeCatalog.DepartmentId,
                root.Id, "Product Studio", OrgUnitLifecycleState.Active, Today.AddDays(-50)));

            var people = new List<(Guid Id, Guid Assignment, Employment Employment)>();
            (Guid Id, Guid Assignment, Employment Employment) Hire(string first, DateTime start, Guid? employeeId = null)
            {
                var id = employeeId ?? Guid.NewGuid();
                if (employeeId is null)
                {
                    var employee = Employee.Create(TenantA, first, "Test", $"{first.ToLowerInvariant()}@example.com", employeeNumber: $"E-{Guid.NewGuid():N}");
                    seed.Employees.Add(employee);
                    id = employee.Id;
                }

                var employment = Employment.Start(TenantA, id, start, "FullTime", WorkforceSourceType.Manual);
                var assignment = WorkAssignment.Create(TenantA, employment.Id, id, (random.Next(2) == 0 ? root : team).Id, $"Role {first}", "Tunis", true, start, null, WorkforceSourceType.Manual);
                seed.Employments.Add(employment);
                seed.WorkAssignments.Add(assignment);
                var person = (id, assignment.Id, employment);
                people.Add(person);
                return person;
            }

            ManagerRelationship Line((Guid Id, Guid Assignment, Employment _) subject, (Guid Id, Guid Assignment, Employment _) manager, DateTime from,
                ReportingRelationshipType type = ReportingRelationshipType.PrimaryManager)
            {
                var line = ManagerRelationship.Create(TenantA, subject.Id, manager.Id, subject.Assignment, manager.Assignment, type, from, WorkforceSourceType.Manual);
                seed.ManagerRelationships.Add(line);
                return line;
            }

            var ceo = Hire("Ceo", longAgo);
            var lines = new Dictionary<Guid, ManagerRelationship>();
            foreach (var vp in new[] { "Vpa", "Vpb", "Vpc" }) lines[Hire(vp, longAgo).Id] = Line(people[^1], ceo, longAgo);

            // Forty joiners over 100 days, every fifth sharing the day before; each reports to someone already there.
            for (var i = 0; i < 40; i++)
            {
                var day = TodayAt.AddDays(-100 + (i % 5 == 0 && i > 0 ? (i - 1) * 3 : i * 3));
                var manager = people[random.Next(people.Count)];
                var joiner = Hire($"Joiner{i}", day);
                lines[joiner.Id] = Line(joiner, manager, day);
                if (i % 4 == 0) Line(joiner, people[random.Next(4)], day, ReportingRelationshipType.SecondaryManager);
                if (i % 7 == 3)
                {
                    // Someone already there, not above the joiner, moves under them on their first day.
                    var mover = people[1 + random.Next(people.Count - 2)];
                    var above = new HashSet<Guid>();
                    for (var up = joiner.Id; lines.TryGetValue(up, out var line) && above.Add(line.ManagerEmployeeId); up = line.ManagerEmployeeId) { }
                    if (!above.Contains(mover.Id) && lines.TryGetValue(mover.Id, out var current) && current.EffectiveFrom < day)
                    {
                        current.End(day);
                        lines[mover.Id] = Line(mover, joiner, day);
                    }
                }
            }

            // A manager whose last day comes before their report starts; a rehire after a gap; a renewal with none.
            var leaving = Hire("Leaving", longAgo);
            leaving.Employment.End(TodayAt.AddDays(-20));
            Line(Hire("Orphan", TodayAt.AddDays(-10)), leaving, TodayAt.AddDays(-10));
            var rehired = Hire("Rehired", longAgo);
            rehired.Employment.End(TodayAt.AddDays(-60));
            Line(Hire("Rehired", TodayAt.AddDays(-30), rehired.Id), ceo, TodayAt.AddDays(-30));
            var renewed = Hire("Renewed", longAgo);
            renewed.Employment.End(TodayAt.AddDays(-40));
            Hire("Renewed", TodayAt.AddDays(-40), renewed.Id);
            Line(Hire("Future", TodayAt.AddDays(15)), ceo, TodayAt.AddDays(15));
            await seed.SaveChangesAsync();
        }

        var world = new World(db, [], [], Guid.Empty);
        var changes = await ChangesAsync(world, Today.AddDays(-120), Today.AddDays(30));
        var joins = changes.Where(c => c.Kind == OrgChartChangeKinds.Join).ToList();

        Assert.Equal(40 + 3, joins.Count); // the joiners, the orphan, the rehire and the future joiner; not the renewal
        Assert.True(joins.Select(c => c.Date).Distinct().Count() > 30);
        Assert.Contains(joins, c => c.Person!.DirectCount > 0);
        Assert.Contains(joins, c => c.Person!.DottedLineManagerKeys.Count > 0);
        Assert.Contains(joins, c => c.Person!.DisplayName == "Orphan Test" && c.ManagerKey is null);
        Assert.Contains(joins, c => c.Person!.DisplayName == "Rehired Test");
        Assert.DoesNotContain(joins, c => c.Person!.DisplayName == "Renewed Test");
        Assert.Contains(joins, c => c.Person!.Unit!.Name == "Product A");
        Assert.Contains(joins, c => c.Person!.Unit!.Name == "Product Studio");

        foreach (var join in joins)
        {
            var chart = await ReadAsync(world, OrgChartScopes.Tenant, null, hr: true, asOf: join.Date);
            var expected = Assert.Single(chart.People, p => p.EmployeeKey == join.EmployeeKey);
            Assert.Equal(JsonSerializer.Serialize(expected), JsonSerializer.Serialize(join.Person));
            Assert.Equal(expected.ManagerKey, join.ManagerKey);
        }
    }

    [Fact]
    public async Task A_field_hidden_from_employees_is_hidden_from_them_and_shown_to_HR()
    {
        var world = await SeedAsync();
        var fields = TenantSettingsDto.DefaultEmployeeFieldConfig;
        fields["jobTitle"] = new FieldConfig(Visible: true, Required: false, VisibleToEmployee: false, VisibleToManager: true);
        fields["hireDate"] = new FieldConfig(Visible: true, Required: true, VisibleToEmployee: false, VisibleToManager: false);
        var settings = new TenantSettingsDto { EmployeeFieldConfig = fields };

        var asEmployee = await ReadAsync(world, OrgChartScopes.Tenant, world.Ids["Aicha"], settings: settings);
        Assert.All(asEmployee.People, p => Assert.Equal((null, null, false), (p.JobTitle, p.StartYear, p.IsNew)));

        // A manager reads their own branch as a manager: titles yes, hire dates no.
        var asManager = await ReadAsync(world, OrgChartScopes.DirectReports, world.Ids["Mariam"], settings: settings);
        Assert.Equal(("QA Engineer", (int?)null), (Get(asManager, world, "Aicha").JobTitle, Get(asManager, world, "Aicha").StartYear));
        Assert.Null(Get(asManager, world, "Amira").JobTitle);

        var asHr = await ReadAsync(world, OrgChartScopes.Tenant, world.Ids["Nour"], hr: true, settings: settings);
        Assert.Equal(("QA Engineer", Today.AddDays(-30).Year, true), (Get(asHr, world, "Aicha").JobTitle, Get(asHr, world, "Aicha").StartYear, Get(asHr, world, "Aicha").IsNew));
    }

    // ── Controller: who may ask for what ────────────────────────────────────

    private static ClaimsPrincipal Caller(Guid? employeeId, params (string Key, string Scope)[] grants)
    {
        var claims = new List<Claim> { new(CustomClaimTypes.TenantId, TenantA.ToString()) };
        if (employeeId is { } employee) claims.Add(new(CustomClaimTypes.EmployeeId, employee.ToString()));
        claims.AddRange(grants.Select(grant => new Claim(CustomClaimTypes.CorePermission, CorePermissionClaimValue.Encode(grant.Key, grant.Scope))));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"));
    }

    private static (OrgChartController Controller, Mock<ISender> Sender) Controller(ClaimsPrincipal caller)
    {
        var sender = new Mock<ISender>();
        sender.Setup(s => s.Send(It.IsAny<OrgChartQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((OrgChartQuery q, CancellationToken _) => Result.Success(new OrgChartDto(q.AsOf, q.Scope, null, [], [], [])));
        sender.Setup(s => s.Send(It.IsAny<OrgChartChangesQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success<IReadOnlyList<OrgChartChangeDto>>([]));
        return (new OrgChartController(sender.Object, new CoreAccessPolicyService())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = caller } },
        }, sender);
    }

    private static readonly (string, string) Everyone = (CorePermissions.OrgChartView, PermissionScopes.Tenant);
    private static readonly (string, string) Branch = (CorePermissions.OrgChartView, PermissionScopes.DirectReports);
    private static readonly (string, string) Hr = (CorePermissions.EmployeeView, PermissionScopes.Tenant);

    [Fact]
    public async Task Without_the_permission_the_chart_is_forbidden()
    {
        var (controller, sender) = Controller(Caller(Guid.NewGuid(), (CorePermissions.EmployeeView, PermissionScopes.Self)));
        Assert.IsType<ForbidResult>(await controller.Get(null, default));
        sender.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Another_date_than_today_is_for_HR_only()
    {
        var (employee, employeeSender) = Controller(Caller(Guid.NewGuid(), Everyone));
        Assert.IsType<ForbidResult>(await employee.Get(Today.AddDays(30), default));
        Assert.IsType<OkObjectResult>(await employee.Get(Today, default));
        employeeSender.Verify(s => s.Send(It.IsAny<OrgChartQuery>(), It.IsAny<CancellationToken>()), Times.Once);

        var (hr, hrSender) = Controller(Caller(Guid.NewGuid(), Everyone, Hr));
        var ok = Assert.IsType<OkObjectResult>(await hr.Get(Today.AddDays(-90), default));
        Assert.Equal(Today.AddDays(-90), Assert.IsType<ApiResponse<OrgChartDto>>(ok.Value).Data!.AsOf);
        hrSender.Verify(s => s.Send(It.Is<OrgChartQuery>(q => q.HrAudience), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task The_scope_and_viewer_come_from_the_token()
    {
        var me = Guid.NewGuid();
        var (controller, sender) = Controller(Caller(me, Branch));
        await controller.Get(null, default);
        sender.Verify(s => s.Send(
            It.Is<OrgChartQuery>(q => q.Scope == OrgChartScopes.DirectReports && q.ViewerEmployeeId == me && !q.HrAudience && q.AsOf == Today),
            It.IsAny<CancellationToken>()), Times.Once);

        var (wide, wideSender) = Controller(Caller(me, Branch, Everyone));
        await wide.Get(null, default);
        wideSender.Verify(s => s.Send(It.Is<OrgChartQuery>(q => q.Scope == OrgChartScopes.Tenant), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Changes_are_for_HR_only_over_a_bounded_window()
    {
        var (employee, employeeSender) = Controller(Caller(Guid.NewGuid(), Everyone));
        Assert.IsType<ForbidResult>(await employee.GetChanges(Today, Today.AddDays(30), default));
        employeeSender.VerifyNoOtherCalls();
        var (manager, _) = Controller(Caller(Guid.NewGuid(), Branch, (CorePermissions.EmployeeView, PermissionScopes.DirectReports)));
        Assert.IsType<ForbidResult>(await manager.GetChanges(Today, Today.AddDays(30), default));
        var (hrWithoutChart, _) = Controller(Caller(Guid.NewGuid(), Hr));
        Assert.IsType<ForbidResult>(await hrWithoutChart.GetChanges(Today, Today.AddDays(30), default));

        var (hr, hrSender) = Controller(Caller(Guid.NewGuid(), Everyone, Hr));
        Assert.IsType<BadRequestObjectResult>(await hr.GetChanges(Today, Today.AddDays(-1), default));
        Assert.IsType<BadRequestObjectResult>(await hr.GetChanges(Today, Today.AddDays(732), default));
        Assert.IsType<BadRequestObjectResult>(await hr.GetChanges(null, Today, default));
        Assert.IsType<OkObjectResult>(await hr.GetChanges(Today, Today.AddDays(731), default));
        hrSender.Verify(s => s.Send(It.Is<OrgChartChangesQuery>(q => q.From == Today && q.To == Today.AddDays(731)), It.IsAny<CancellationToken>()), Times.Once);
    }
}

using EY.HRPlatform.Performance.Domain.Defaults;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.DemoSeed;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Infrastructure.Persistence;

/// <summary>
/// Opt-in, idempotent development seed for the Atlas Performance progress demo. The complete
/// lifecycle is built through domain methods so a fresh database never needs follow-up repair SQL.
/// Enable with DemoSeed__AtlasPerformance__Enabled=true and provide the Atlas tenant id.
/// </summary>
public static class AtlasPerformanceDemoSeeder
{
    public const string CycleSlug = "atlas-progress-demo";
    public const string AssessmentCycleSlug = "atlas-evaluation-execution-demo";
    public const string IsolationCycleSlug = "atlas-evaluation-isolation-demo";
    public const string EvaluationRoundName = "FY2026 annual evaluation";
    public const string AssessmentRoundName = "FY2026 Year-end evaluation";
    public const string IsolationEvaluationRoundName = "FY2026 manager evaluation";

    private static readonly Guid EmployeeId = CanonicalDemoSeed.LifecycleEmployeeIds[1];
    private static readonly Guid ManagerId = CanonicalDemoSeed.DirectorId;
    private static readonly Guid ManagerUserId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid EmployeeUserId = Guid.Parse("10000000-0000-0000-0000-000000000003");

    public static async Task ResetAsync(
        PerformanceDbContext db,
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        if (tenantId != CanonicalDemoSeed.TenantId)
            throw new InvalidOperationException("Canonical Performance reset is restricted to the configured demo tenant.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await CanonicalTenantResetter.ResetAsync(db, tenantId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public static async Task SeedAsync(
        PerformanceDbContext db,
        Guid tenantId,
        DateTime asOfUtc,
        CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("The Atlas tenant id is required.", nameof(tenantId));

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var existingCycle = await db.PerformanceCycles
            .IgnoreQueryFilters()
            .Include(cycle => cycle.Participants)
            .SingleOrDefaultAsync(
                cycle => cycle.TenantId == tenantId && cycle.Slug == CycleSlug,
                cancellationToken);
        if (existingCycle is not null)
        {
            await EnsureAssessmentExecutionAsync(db, tenantId, asOfUtc, cancellationToken);
            await WriteReceiptAsync(db, tenantId, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return;
        }

        var year = asOfUtc.ToUniversalTime().Year;
        var opening = new DateTime(year, 1, 5, 9, 0, 0, DateTimeKind.Utc);
        var submissionDeadline = new DateTime(year, 1, 31, 17, 0, 0, DateTimeKind.Utc);
        var approvalDeadline = new DateTime(year, 2, 14, 17, 0, 0, DateTimeKind.Utc);
        var lockDate = new DateTime(year, 2, 15, 9, 0, 0, DateTimeKind.Utc);

        var cycle = PerformanceCycle.CreateDraft(
            tenantId,
            $"FY{year} Atlas progress demo",
            CycleSlug,
            year,
            "Locked objective baseline with representative progress states.",
            ManagerUserId,
            "Flit Manager",
            opening,
            submissionDeadline,
            approvalDeadline,
            lockDate,
            CampaignPlanningRulesSnapshot.Capture(
                5,
                "0.30,0.40",
                "Quantitative,Qualitative",
                ManagerUserId,
                opening));

        var strategic = cycle.AddStrategicObjective(
            "Improve client delivery quality",
            "Shared strategic outcome for the Atlas progress walkthrough.",
            "Advisory");
        var workforce = tenantId == CanonicalDemoSeed.TenantId
            ? CanonicalDemoSeed.BuildEmployees().Where(employee => employee.IsActive).ToList()
            : [CanonicalDemoSeed.GetEmployee(EmployeeId)];
        var workforceById = workforce.ToDictionary(employee => employee.Id);
        cycle.Launch(workforce.Select(employee =>
        {
            var manager = employee.ManagerId is { } managerId && workforceById.TryGetValue(managerId, out var resolvedManager)
                ? resolvedManager
                : CanonicalDemoSeed.GetEmployee(ManagerId);
            return new ResolvedLaunchParticipant(
                employee.Id,
                $"{employee.FirstName} {employee.LastName}",
                manager.Id,
                $"{manager.FirstName} {manager.LastName}",
                false,
                null,
                employee.EmployeeNumber,
                employee.Email,
                null,
                employee.Department,
                employee.JobTitle,
                manager.Id,
                $"{manager.FirstName} {manager.LastName}");
        }).ToArray(), opening.AddDays(1));

        var plans = new List<EmployeeObjectivePlan>(workforce.Count);
        foreach (var employee in workforce)
        {
            var currentParticipant = cycle.Participants.Single(item => item.EmployeeId == employee.Id);
            var currentPlan = EmployeeObjectivePlan.CreateDraft(cycle, currentParticipant, opening.AddDays(2));
            currentPlan.AddObjective(cycle, $"Improve {employee.Department} delivery quality", ObjectiveAlignmentType.StrategicObjective,
                strategic.Id, strategic.Title, 40, new DateTime(year, 12, 15, 0, 0, 0, DateTimeKind.Utc),
                "Quantitative", "Delivery quality score", "95", "%", opening.AddDays(2));
            currentPlan.AddObjective(cycle, $"Deliver a measurable {employee.Department} outcome", ObjectiveAlignmentType.StrategicObjective,
                strategic.Id, strategic.Title, 30, new DateTime(year, 12, 15, 0, 0, 0, DateTimeKind.Utc),
                "Quantitative", "Outcome completion", "100", "%", opening.AddDays(2));
            currentPlan.AddObjective(cycle, "Build capability and share knowledge", ObjectiveAlignmentType.StrategicObjective,
                strategic.Id, strategic.Title, 30, new DateTime(year, 12, 15, 0, 0, 0, DateTimeKind.Utc),
                "Qualitative", null, null, null, opening.AddDays(2),
                successCriteria: "Evidence of capability growth and knowledge sharing is recorded.");
            var submission = currentPlan.Submit(cycle, currentParticipant, opening.AddDays(10));
            if (!submission.Succeeded)
                throw new InvalidOperationException($"Canonical objective plan is invalid for {employee.Email}: " +
                    string.Join("; ", submission.BlockingReasons.Select(reason => reason.Message)));
            currentPlan.Approve(new EmployeeObjectivePlanReviewActor(currentParticipant.ApproverEmployeeId, currentParticipant.ApproverName!), opening.AddDays(11));
            plans.Add(currentPlan);
        }

        var participant = cycle.Participants.Single(item => item.EmployeeId == EmployeeId);
        var plan = plans.Single(item => item.EmployeeId == EmployeeId);
        var objectives = plan.Objectives.ToArray();
        cycle.LockPlanning(ManagerUserId, "Flit Manager", lockDate);

        AddProgress(db, plan.RecordProgress(cycle, objectives[0].Id, 100, null, "95/95", "Target sustained.",
            false, null, new ObjectiveProgressActor(EmployeeUserId, "Sami Analyst"), lockDate.AddDays(40)));
        AddProgress(db, plan.RecordProgress(cycle, objectives[1].Id, 70, null, "8/12", "Initial review wave complete.",
            false, null, new ObjectiveProgressActor(EmployeeUserId, "Sami Analyst"), lockDate.AddDays(55)));
        AddProgress(db, plan.RecordProgress(cycle, objectives[1].Id, 50, 70, "6/12", null,
            true, "Two reviews were reopened after the quality audit.",
            new ObjectiveProgressActor(EmployeeUserId, "Sami Analyst"), lockDate.AddDays(85)));
        AddProgress(db, plan.RecordProgress(cycle, objectives[2].Id, 25, null, null, "Monthly coaching started.",
            false, null, new ObjectiveProgressActor(EmployeeUserId, "Sami Analyst"), lockDate.AddDays(65)));

        SeedCheckInScenario(db, cycle, plan, objectives[1], lockDate);

        db.PerformanceCycles.Add(cycle);
        db.EmployeeObjectivePlans.AddRange(plans);
        await db.SaveChangesAsync(cancellationToken);

        // Preserve the focused one-person fixture used by the non-canonical
        // isolation tests while keeping the canonical tenant on the faster,
        // six-person executable round.
        if (tenantId != CanonicalDemoSeed.TenantId)
            await EnsureTenantAEvaluationAsync(db, tenantId, cycle, plan, asOfUtc, cancellationToken);

        await EnsureAssessmentExecutionAsync(db, tenantId, asOfUtc, cancellationToken);
        await WriteReceiptAsync(db, tenantId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task WriteReceiptAsync(PerformanceDbContext db, Guid tenantId, CancellationToken cancellationToken)
    {
        var receipt = await db.CanonicalSeedReceipts.IgnoreQueryFilters()
            .SingleOrDefaultAsync(item => item.TenantId == tenantId, cancellationToken);
        if (receipt is null)
            db.CanonicalSeedReceipts.Add(CanonicalSeedReceipt.Create(tenantId, CanonicalDemoSeed.AsOfUtc));
        else
        {
            if (receipt.ManifestHash != CanonicalDemoSeed.ManifestHash)
                throw new InvalidOperationException("Canonical Performance seed receipt drifted from the manifest. Run the canonical fresh reset.");
            receipt.Refresh(CanonicalDemoSeed.AsOfUtc);
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Seeds a deliberately different tenant-owned evaluation scenario used to prove that
    /// configuration, rounds, snapshots, participants, and assignments never bleed across tenants.
    /// </summary>
    public static async Task SeedIsolationTenantAsync(
        PerformanceDbContext db,
        Guid tenantId,
        DateTime asOfUtc,
        CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("The isolation tenant id is required.", nameof(tenantId));

        if (await db.EvaluationRounds.IgnoreQueryFilters().AnyAsync(
                round => round.TenantId == tenantId && round.Name == IsolationEvaluationRoundName,
                cancellationToken))
            return;

        var year = asOfUtc.ToUniversalTime().Year;
        var opening = new DateTime(year, 1, 5, 9, 0, 0, DateTimeKind.Utc);
        var managerEmployeeId = Guid.Parse("30000000-0000-0000-0000-000000000001");
        var employeeId = Guid.Parse("30000000-0000-0000-0000-000000000003");
        var managerUserId = Guid.Parse("11000000-0000-0000-0000-000000000001");

        var cycle = PerformanceCycle.CreateDraft(
            tenantId,
            $"FY{year} isolation evaluation demo",
            IsolationCycleSlug,
            year,
            "A contrasting manager-only evaluation used for tenant-isolation verification.",
            managerUserId,
            "Nadia Manager",
            opening,
            opening.AddDays(25),
            opening.AddDays(40),
            opening.AddDays(41),
            CampaignPlanningRulesSnapshot.Capture(
                1, "1.00", "Quantitative", managerUserId, opening));
        var strategic = cycle.AddStrategicObjective(
            "Deliver the annual client portfolio",
            "The single objective represents the complete evaluation baseline.",
            "Consulting");
        cycle.Launch(
            [new ResolvedLaunchParticipant(
                employeeId,
                "Leila Consultant",
                managerEmployeeId,
                "Nadia Manager",
                false,
                null,
                "LEILA-001",
                "leila.consultant@isolation.example",
                null,
                "Consulting",
                "Consultant",
                managerEmployeeId,
                "Nadia Manager")],
            opening.AddDays(1));

        var participant = cycle.Participants.Single(item => item.EmployeeId == employeeId);
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, opening.AddDays(2));
        plan.AddObjective(
            cycle,
            "Deliver the annual client portfolio",
            ObjectiveAlignmentType.StrategicObjective,
            strategic.Id,
            strategic.Title,
            100,
            new DateTime(year, 12, 15, 0, 0, 0, DateTimeKind.Utc),
            "Quantitative",
            "Portfolio delivery",
            "100",
            "%",
            opening.AddDays(2));
        var submission = plan.Submit(cycle, participant, opening.AddDays(10));
        if (!submission.Succeeded)
            throw new InvalidOperationException("The isolation objective plan is invalid: " +
                string.Join("; ", submission.BlockingReasons.Select(reason => reason.Message)));
        plan.Approve(new EmployeeObjectivePlanReviewActor(managerEmployeeId, "Nadia Manager"), opening.AddDays(11));
        cycle.LockPlanning(managerUserId, "Nadia Manager", opening.AddDays(41));

        var scale = EvaluationRatingScale.CreateDraft(
            tenantId,
            "Four-level delivery scale",
            "A compact scale that remains visibly different from the Atlas tenant configuration.",
            [
                new("Needs improvement", "Delivery is below the agreed standard.", "Name the recovery action."),
                new("Developing", "Delivery is progressing but inconsistent.", "Describe the material gap."),
                new("Achieves", "Delivery consistently meets the agreed standard.", "Anchor the rating in evidence."),
                new("Excels", "Delivery creates sustained impact beyond the agreed standard.", "Describe the wider impact.")
            ]);
        scale.Activate();
        var template = EvaluationTemplate.CreateDraft(
            tenantId,
            "Objectives-only manager evaluation",
            "A manager-only evaluation grounded entirely in the approved objective baseline.",
            "Assess the objective outcome against the frozen baseline and supporting evidence.");
        template.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.Objectives,
            "Objectives — 100%",
            "The approved objective plan is the complete evaluation baseline."));
        template.Activate();

        var round = EvaluationRound.CreateDraft(
            tenantId,
            cycle,
            IsolationEvaluationRoundName,
            "Manager-only contrast for tenant-isolation verification.",
            EvaluationRoundType.YearEnd,
            EvaluationAssessmentModel.ManagerOnly);
        round.SelectRatingScale(scale);
        round.SelectTemplate(template);
        var launchAt = asOfUtc.ToUniversalTime();
        round.SetDeadlines(null, launchAt.AddDays(21), launchAt.AddDays(28));
        var launch = round.Launch(
            cycle,
            scale,
            template,
            sourceExpectationSet: null,
            sourceProficiencyScale: null,
            referencedSkills: [],
            [new EvaluationRoundLaunchCandidate(participant, managerEmployeeId, "Nadia Manager", plan)],
            launchAt);

        db.PerformanceCycles.Add(cycle);
        db.EmployeeObjectivePlans.Add(plan);
        db.EvaluationRatingScales.Add(scale);
        db.EvaluationTemplates.Add(template);
        db.EvaluationRounds.Add(round);
        db.EvaluationAssignments.AddRange(launch.Assignments);
        await SeedManagerOnlyFinalizedAsync(db, round, asOfUtc, cancellationToken, launch.Assignments);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureTenantAEvaluationAsync(
        PerformanceDbContext db,
        Guid tenantId,
        PerformanceCycle cycle,
        EmployeeObjectivePlan plan,
        DateTime asOfUtc,
        CancellationToken cancellationToken)
    {
        var skillDefaults = SkillConfigurationDefaults.InstantiateForTenant(tenantId);
        var skillScale = await db.ProficiencyScales
            .IgnoreQueryFilters().Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.TenantId == tenantId && item.Name == SkillConfigurationDefaults.DefaultScaleName, cancellationToken);
        var skillSet = await db.SkillExpectationSets
            .IgnoreQueryFilters().Include(item => item.Items)
            .SingleOrDefaultAsync(item => item.TenantId == tenantId && item.Name == SkillConfigurationDefaults.DefaultSetName, cancellationToken);
        var skillEntities = await db.Skills.IgnoreQueryFilters()
            .Where(item => item.TenantId == tenantId && item.Status == SkillLifecycleStatus.Active)
            .ToListAsync(cancellationToken);
        if (skillScale is null || skillSet is null || skillEntities.Count == 0)
        {
            skillScale ??= skillDefaults.ProficiencyScale;
            skillSet ??= skillDefaults.ExpectationSet;
            if (skillEntities.Count == 0)
            {
                db.SkillCategories.AddRange(skillDefaults.Categories);
                db.Skills.AddRange(skillDefaults.Skills);
                skillEntities = skillDefaults.Skills.ToList();
            }
            if (skillScale.Id == skillDefaults.ProficiencyScale.Id) db.ProficiencyScales.Add(skillScale);
            if (skillSet.Id == skillDefaults.ExpectationSet.Id) db.SkillExpectationSets.Add(skillSet);
            await db.SaveChangesAsync(cancellationToken);
        }

        if (await db.EvaluationRounds.IgnoreQueryFilters().AnyAsync(
                round => round.TenantId == tenantId && round.Name == EvaluationRoundName,
                cancellationToken))
        {
            await EnsureAssessmentExecutionAsync(db, tenantId, asOfUtc, cancellationToken);
            return;
        }

        var scale = await db.EvaluationRatingScales
            .IgnoreQueryFilters()
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(
                item => item.TenantId == tenantId && item.Name == EvaluationConfigurationDefaults.DefaultScaleName,
                cancellationToken);
        var template = await db.EvaluationTemplates
            .IgnoreQueryFilters()
            .AsSplitQuery()
            .Include(item => item.Sections)
            .Include(item => item.Questions)
            .SingleOrDefaultAsync(
                item => item.TenantId == tenantId && item.Name == EvaluationConfigurationDefaults.DefaultTemplateName,
                cancellationToken);
        if (scale is null || template is null)
        {
            var defaults = EvaluationConfigurationDefaults.InstantiateForTenant(tenantId);
            if (scale is null)
            {
                scale = defaults.RatingScale;
                db.EvaluationRatingScales.Add(scale);
            }
            if (template is null)
            {
                template = defaults.Template;
                db.EvaluationTemplates.Add(template);
            }
        }

        var skillsTemplate = EvaluationTemplate.CreateDraft(
            tenantId,
            "Annual evaluation with capabilities",
            "Objectives and capability expectations in one review.",
            "Rate outcomes and demonstrated capability with specific evidence.");
        skillsTemplate.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.Objectives, "Objectives", "Review the approved objective baseline."));
        skillsTemplate.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.Skills, "Skills", "Compare demonstrated capability with the expected level."));
        var reflection = skillsTemplate.AddSection(new EvaluationTemplateSectionDraft(
            EvaluationSectionType.CustomQuestions, "Reflection", "Capture context behind the result."));
        skillsTemplate.AddQuestion(reflection.Id, new EvaluationTemplateQuestionDraft(
            "What outcome or capability should carry forward?", EvaluationQuestionType.Text, true, EvaluationTargetRater.Both));
        skillsTemplate.Activate();

        var participant = cycle.Participants.Single(item => item.EmployeeId == EmployeeId);
        var round = EvaluationRound.CreateDraft(
            tenantId,
            cycle,
            EvaluationRoundName,
            "A complete annual self and manager evaluation walkthrough.",
            EvaluationRoundType.YearEnd,
            EvaluationAssessmentModel.SelfAndManager);
        round.SelectRatingScale(scale);
        round.SelectTemplate(skillsTemplate);
        var categoryNames = await db.SkillCategories.IgnoreQueryFilters()
            .Where(item => item.TenantId == tenantId)
            .ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
        round.SelectExpectationSet(
            skillSet,
            skillScale,
            skillEntities.Select(skill => new EvaluationRoundSkillSource(
                skill.Id, skill.Name, categoryNames.GetValueOrDefault(skill.SkillCategoryId, string.Empty))).ToArray());
        var launchAt = asOfUtc.ToUniversalTime();
        round.SetDeadlines(launchAt.AddDays(14), launchAt.AddDays(28), launchAt.AddDays(35));
        var plansByEmployeeId = await db.EmployeeObjectivePlans.IgnoreQueryFilters()
            .Include(item => item.Objectives)
            .Where(item => item.TenantId == tenantId && item.CycleId == cycle.Id)
            .ToDictionaryAsync(item => item.EmployeeId, cancellationToken);
        var candidates = cycle.Participants
            .Select(item =>
        {
            if (!plansByEmployeeId.TryGetValue(item.EmployeeId, out var participantPlan))
                throw new InvalidOperationException($"Missing objective plan for evaluation participant {item.EmployeeId}.");

            var reviewer = item.EmployeeId == CanonicalDemoSeed.DirectorId
                ? CanonicalDemoSeed.BuildEmployees()[1]
                : CanonicalDemoSeed.GetEmployee(item.ApproverEmployeeId);

            return new EvaluationRoundLaunchCandidate(
                item,
                reviewer.Id,
                $"{reviewer.FirstName} {reviewer.LastName}",
                participantPlan);
        }).ToArray();
        var launch = round.Launch(
            cycle,
            scale,
            skillsTemplate,
            sourceExpectationSet: skillSet,
            sourceProficiencyScale: skillScale,
            referencedSkills: skillEntities,
            candidates,
            launchAt);

        db.EvaluationRounds.Add(round);
        db.EvaluationTemplates.Add(skillsTemplate);
        db.EvaluationAssignments.AddRange(launch.Assignments);
        await db.SaveChangesAsync(cancellationToken);
        await EnsureAssessmentExecutionAsync(db, tenantId, asOfUtc, cancellationToken);
    }

    private static async Task EnsureAssessmentExecutionAsync(
        PerformanceDbContext db,
        Guid tenantId,
        DateTime asOfUtc,
        CancellationToken cancellationToken)
    {
        await EnsureEvaluationConfigurationAsync(db, tenantId, cancellationToken);

        var existing = await db.EvaluationRounds
            .IgnoreQueryFilters()
            .Include(round => round.Participants)
            .SingleOrDefaultAsync(round => round.TenantId == tenantId && round.Name == AssessmentRoundName, cancellationToken);
        if (existing is not null)
        {
            var existingStates = await db.EvaluationAssignments.IgnoreQueryFilters()
                .Where(item => item.RoundId == existing.Id)
                .Select(item => item.Status)
                .ToListAsync(cancellationToken);
            if (existingStates.Any(status => status != EvaluationAssignmentStatus.NotStarted))
                return;
            await SeedAssessmentAssignmentStatesAsync(db, existing, asOfUtc, cancellationToken);
            return;
        }

        var year = asOfUtc.ToUniversalTime().Year;
        var opening = new DateTime(year, 7, 1, 9, 0, 0, DateTimeKind.Utc);
        // Keep the executable evaluation round scoped to documented personas so
        // the verification harness can complete every participant transition
        // without inventing credentials for synthetic workforce records.
        var workforce = tenantId == CanonicalDemoSeed.TenantId
            ? CanonicalDemoSeed.LifecycleEmployeeIds.Select(CanonicalDemoSeed.GetEmployee).ToList()
            : [CanonicalDemoSeed.GetEmployee(EmployeeId)];
        var workforceById = workforce.ToDictionary(employee => employee.Id);
        var participants = workforce.Select(employee =>
        {
            var manager = employee.ManagerId is { } managerId && workforceById.TryGetValue(managerId, out var resolvedManager)
                ? resolvedManager
                : employee.Id == CanonicalDemoSeed.DirectorId
                    ? CanonicalDemoSeed.BuildEmployees()[1]
                    : CanonicalDemoSeed.GetEmployee(ManagerId);
            return (employee.Id,
                Name: $"{employee.FirstName} {employee.LastName}",
                employee.Email,
                ManagerId: manager.Id,
                ManagerName: $"{manager.FirstName} {manager.LastName}");
        }).ToArray();

        var cycle = PerformanceCycle.CreateDraft(
            tenantId, $"FY{year} evaluation execution demo", AssessmentCycleSlug, year,
            "Seeded assessment lifecycle states for the year-end evaluation walkthrough.",
            ManagerUserId, "Flit Manager", opening, opening.AddDays(20), opening.AddDays(30), opening.AddDays(31),
            CampaignPlanningRulesSnapshot.Capture(1, "1.00", "Quantitative", ManagerUserId, opening));
        var strategic = cycle.AddStrategicObjective(
            "Deliver the annual client portfolio", "Frozen baseline for the year-end assessment.", "Advisory");
        cycle.Launch(participants.Select(item => new ResolvedLaunchParticipant(
            item.Id, item.Name, item.ManagerId, item.ManagerName, false, null, item.Id.ToString("N"),
            item.Email, null, "Advisory", "Consultant", item.ManagerId, item.ManagerName)).ToArray(), opening.AddDays(1));

        var plans = new List<EmployeeObjectivePlan>();
        foreach (var item in participants)
        {
            var participant = cycle.Participants.Single(candidate => candidate.EmployeeId == item.Id);
            var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, opening.AddDays(2));
            plan.AddObjective(cycle, "Deliver the annual client portfolio", ObjectiveAlignmentType.StrategicObjective,
                strategic.Id, strategic.Title, 100, new DateTime(year, 12, 15, 0, 0, 0, DateTimeKind.Utc),
                "Quantitative", "Portfolio delivery", "100", "%", opening.AddDays(2));
            var submission = plan.Submit(cycle, participant, opening.AddDays(3));
            if (!submission.Succeeded)
                throw new InvalidOperationException("The assessment demo objective plan is invalid.");
            plan.Approve(new EmployeeObjectivePlanReviewActor(item.ManagerId, item.ManagerName), opening.AddDays(4));
            plans.Add(plan);
        }
        cycle.LockPlanning(ManagerUserId, "Flit Manager", opening.AddDays(5));

        var scale = await db.EvaluationRatingScales.IgnoreQueryFilters().Include(item => item.Levels)
            .SingleAsync(item => item.TenantId == tenantId && item.Name == EvaluationConfigurationDefaults.DefaultScaleName, cancellationToken);
        var skillScale = await db.ProficiencyScales.IgnoreQueryFilters().Include(item => item.Levels)
            .SingleAsync(item => item.TenantId == tenantId && item.Name == SkillConfigurationDefaults.DefaultScaleName, cancellationToken);
        var skillSet = await db.SkillExpectationSets.IgnoreQueryFilters().Include(item => item.Items)
            .SingleAsync(item => item.TenantId == tenantId && item.Name == SkillConfigurationDefaults.DefaultSetName, cancellationToken);
        var skills = await db.Skills.IgnoreQueryFilters().Where(item => item.TenantId == tenantId && item.Status == SkillLifecycleStatus.Active).ToListAsync(cancellationToken);
        var categoryNames = await db.SkillCategories.IgnoreQueryFilters().Where(item => item.TenantId == tenantId)
            .ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
        var template = CreateSkillsTemplate(tenantId);
        var round = EvaluationRound.CreateDraft(tenantId, cycle, AssessmentRoundName,
            "Full self and manager year-end evaluation lifecycle walkthrough.", EvaluationRoundType.YearEnd, EvaluationAssessmentModel.SelfAndManager);
        round.SelectRatingScale(scale);
        round.SelectTemplate(template);
        round.SelectExpectationSet(skillSet, skillScale, skills.Select(skill => new EvaluationRoundSkillSource(
            skill.Id, skill.Name, categoryNames.GetValueOrDefault(skill.SkillCategoryId, string.Empty))).ToArray());
        round.SetWeights(70, 30);
        round.SetDeadlines(opening.AddDays(14), opening.AddDays(28), opening.AddDays(35));
        var launch = round.Launch(cycle, scale, template, skillSet, skillScale, skills,
            cycle.Participants.Select((participant, index) => new EvaluationRoundLaunchCandidate(
                participant, participants[index].ManagerId, participants[index].ManagerName, plans[index])).ToArray(), opening.AddDays(6));

        db.PerformanceCycles.Add(cycle);
        db.EmployeeObjectivePlans.AddRange(plans);
        db.EvaluationTemplates.Add(template);
        db.EvaluationRounds.Add(round);
        db.EvaluationAssignments.AddRange(launch.Assignments);
        await SeedAssessmentAssignmentStatesAsync(db, round, asOfUtc, cancellationToken, launch.Assignments);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task EnsureEvaluationConfigurationAsync(
        PerformanceDbContext db,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var skills = await db.Skills.IgnoreQueryFilters()
            .Where(item => item.TenantId == tenantId && item.Status == SkillLifecycleStatus.Active)
            .ToListAsync(cancellationToken);
        var skillScale = await db.ProficiencyScales.IgnoreQueryFilters()
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.TenantId == tenantId && item.Name == SkillConfigurationDefaults.DefaultScaleName, cancellationToken);
        var skillSet = await db.SkillExpectationSets.IgnoreQueryFilters()
            .Include(item => item.Items)
            .SingleOrDefaultAsync(item => item.TenantId == tenantId && item.Name == SkillConfigurationDefaults.DefaultSetName, cancellationToken);
        var skillDefaults = SkillConfigurationDefaults.InstantiateForTenant(tenantId);
        if (skills.Count == 0)
        {
            db.SkillCategories.AddRange(skillDefaults.Categories);
            db.Skills.AddRange(skillDefaults.Skills);
        }
        if (skillScale is null)
            db.ProficiencyScales.Add(skillDefaults.ProficiencyScale);
        if (skillSet is null)
            db.SkillExpectationSets.Add(skillDefaults.ExpectationSet);

        var ratingScale = await db.EvaluationRatingScales.IgnoreQueryFilters()
            .Include(item => item.Levels)
            .SingleOrDefaultAsync(item => item.TenantId == tenantId && item.Name == EvaluationConfigurationDefaults.DefaultScaleName, cancellationToken);
        var template = await db.EvaluationTemplates.IgnoreQueryFilters()
            .AsSplitQuery()
            .Include(item => item.Sections)
            .Include(item => item.Questions)
            .SingleOrDefaultAsync(item => item.TenantId == tenantId && item.Name == EvaluationConfigurationDefaults.DefaultTemplateName, cancellationToken);
        var evaluationDefaults = EvaluationConfigurationDefaults.InstantiateForTenant(tenantId);
        if (ratingScale is null)
            db.EvaluationRatingScales.Add(evaluationDefaults.RatingScale);
        if (template is null)
            db.EvaluationTemplates.Add(evaluationDefaults.Template);

        await db.SaveChangesAsync(cancellationToken);
    }

    private static EvaluationTemplate CreateSkillsTemplate(Guid tenantId)
    {
        var template = EvaluationTemplate.CreateDraft(tenantId, "Year-end outcomes and capabilities",
            "Objectives, capability expectations, and reflection.", "Use evidence from the year-end review.");
        template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.Objectives, "Objectives", "Review the approved objective baseline."));
        template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.Skills, "Skills", "Compare capability with expected levels."));
        var reflection = template.AddSection(new EvaluationTemplateSectionDraft(EvaluationSectionType.CustomQuestions, "Reflection", "Capture context behind the result."));
        template.AddQuestion(reflection.Id, new EvaluationTemplateQuestionDraft(
            "What outcome or capability should carry forward?", EvaluationQuestionType.Text, true, EvaluationTargetRater.Both));
        template.Activate();
        return template;
    }

    private static async Task SeedAssessmentAssignmentStatesAsync(
        PerformanceDbContext db,
        EvaluationRound seedRound,
        DateTime asOfUtc,
        CancellationToken cancellationToken,
        IReadOnlyCollection<EvaluationAssignment>? pendingAssignments = null)
    {
        EvaluationRound round;
        List<EvaluationAssignment> assignments;
        if (pendingAssignments is null)
        {
            db.ChangeTracker.Clear();
            round = await EY.HRPlatform.Performance.Features.Evaluations.Rounds.Commands.EvaluationRoundLoader.Query(db)
                .IgnoreQueryFilters().SingleAsync(item => item.Id == seedRound.Id, cancellationToken);
            assignments = await db.EvaluationAssignments.IgnoreQueryFilters()
                .Include(item => item.ObjectiveRatings).Include(item => item.SkillRatings).Include(item => item.QuestionAnswers)
                .Where(item => item.RoundId == round.Id).OrderBy(item => item.ParticipantName).ThenBy(item => item.Kind)
                .ToListAsync(cancellationToken);
        }
        else
        {
            round = seedRound;
            assignments = pendingAssignments.OrderBy(item => item.ParticipantName).ThenBy(item => item.Kind).ToList();
        }
        if (assignments.Count == 0)
            return;

        var snapshot = BuildAssessmentSnapshot(round);
        var byParticipant = assignments.GroupBy(item => item.ParticipantEmployeeId)
            .ToDictionary(group => group.Key, group => group.ToDictionary(item => item.Kind));
        var now = asOfUtc.ToUniversalTime();
        var orderedParticipants = byParticipant.OrderBy(item => item.Key).Select(item => item.Value).ToArray();
        for (var index = 0; index < orderedParticipants.Length; index++)
        {
            var group = orderedParticipants[index];
            if (!group.TryGetValue(EvaluationAssignmentKind.SelfAssessment, out var self) ||
                !group.TryGetValue(EvaluationAssignmentKind.ManagerAssessment, out var manager))
                continue;

            if (index == 1)
            {
                self.SaveDraft(EvaluationAssessmentDraftInput.Empty, snapshot, now);
            }
            else if (index >= 2)
            {
                SaveCompleteDraft(self, snapshot, now, index % 2 == 0);
                self.Submit(snapshot, now.AddMinutes(index));
            }

            if (index == 3)
            {
                SaveCompleteDraft(manager, snapshot, now, false);
                manager.Submit(snapshot, now.AddMinutes(index + 1));
            }
            else if (index >= 4)
            {
                SaveCompleteDraft(manager, snapshot, now, true);
                manager.Submit(snapshot, now.AddMinutes(index + 1));
                manager.Finalize(index == 0 ? null : self,
                    new EvaluationFinalizationInput(index == 5 ? 4 : 3, index == 5 ? 3 : 4,
                        "We discussed the evidence, the capability gap, and the next-year focus."),
                    round.ObjectivesWeightPercent, round.SkillsWeightPercent, round.ScaleSnapshot!.Levels.Count,
                    now.AddMinutes(index + 2));
                if (index == 5)
                    manager.Acknowledge("I acknowledge the evaluation and the agreed focus areas.", now.AddMinutes(index + 3));
            }
        }

        if (pendingAssignments is null)
            await db.SaveChangesAsync(cancellationToken);
    }

    private static EvaluationAssessmentSnapshot BuildAssessmentSnapshot(EvaluationRound round)
    {
        var objectiveIds = round.ObjectivePlanSnapshots.SelectMany(item => item.Objectives).Select(item => item.Id).ToArray();
        return new EvaluationAssessmentSnapshot(
            objectiveIds.Length > 0,
            round.SkillSnapshot is not null,
            objectiveIds,
            round.SkillSnapshot?.Items.Select(item => item.Id).ToArray() ?? [],
            round.TemplateSnapshot!.Questions.Select(item => new EvaluationAssessmentQuestion(
                item.Id, item.Type, item.IsRequired, item.TargetRater, item.AllowNotApplicable)).ToArray(),
            round.ScaleSnapshot!.Levels.Select(item => item.Ordinal).ToArray(),
            round.SkillSnapshot?.Levels.Select(item => item.Ordinal).ToArray() ?? []);
    }

    private static void SaveCompleteDraft(
        EvaluationAssignment assignment,
        EvaluationAssessmentSnapshot snapshot,
        DateTime now,
        bool higherRatings)
    {
        assignment.SaveDraft(new EvaluationAssessmentDraftInput(
            snapshot.ObjectiveSnapshotIds.Select(id => new EvaluationObjectiveRatingInput(id, higherRatings ? 4 : 3, "Evidence recorded against the frozen objective." )).ToArray(),
            snapshot.SkillItemIds.Select(id => new EvaluationSkillRatingInput(id, higherRatings ? 4 : 2, "Observed capability discussed in the review.")).ToArray(),
            snapshot.Questions.Select(question => new EvaluationQuestionAnswerInput(
                question.Id, "The result and capability evidence were reviewed with the participant.", null, false, null)).ToArray()),
            snapshot, now);
    }

    private static async Task SeedManagerOnlyFinalizedAsync(
        PerformanceDbContext db,
        EvaluationRound seedRound,
        DateTime asOfUtc,
        CancellationToken cancellationToken,
        IReadOnlyCollection<EvaluationAssignment>? pendingAssignments = null)
    {
        EvaluationRound round;
        EvaluationAssignment manager;
        if (pendingAssignments is null)
        {
            db.ChangeTracker.Clear();
            round = await EY.HRPlatform.Performance.Features.Evaluations.Rounds.Commands.EvaluationRoundLoader.Query(db)
                .IgnoreQueryFilters().SingleAsync(item => item.Id == seedRound.Id, cancellationToken);
            manager = await db.EvaluationAssignments.IgnoreQueryFilters()
                .Include(item => item.ObjectiveRatings).Include(item => item.SkillRatings).Include(item => item.QuestionAnswers)
                .SingleAsync(item => item.RoundId == round.Id && item.Kind == EvaluationAssignmentKind.ManagerAssessment, cancellationToken);
        }
        else
        {
            round = seedRound;
            manager = pendingAssignments.Single(item => item.Kind == EvaluationAssignmentKind.ManagerAssessment);
        }
        if (manager.Status == EvaluationAssignmentStatus.Finalized)
            return;
        var snapshot = BuildAssessmentSnapshot(round);
        SaveCompleteDraft(manager, snapshot, asOfUtc.ToUniversalTime(), true);
        manager.Submit(snapshot, asOfUtc.ToUniversalTime().AddMinutes(1));
        manager.Finalize(null, new EvaluationFinalizationInput(3, null,
                "The annual objective outcome was reviewed and finalized."),
            100, 0, round.ScaleSnapshot!.Levels.Count, asOfUtc.ToUniversalTime().AddMinutes(2));
        if (pendingAssignments is null)
            await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Builds the end-to-end check-in walkthrough on top of the setback objective: the employee raises a
    /// `Needs discussion` signal, the reviewer plans a check-in linking that objective and signal,
    /// completes it with a shared summary and two agreed follow-up actions, the completion resolves the
    /// signal, the employee posts their one-time response, and then completes their own follow-up action.
    /// Every step runs through domain methods so the demo state is exactly what production would produce.
    /// </summary>
    private static void SeedCheckInScenario(
        PerformanceDbContext db,
        PerformanceCycle cycle,
        EmployeeObjectivePlan plan,
        EmployeeObjective setbackObjective,
        DateTime lockDate)
    {
        // 1. The employee flags the objective that regressed after the audit.
        var signal = ObjectiveDiscussionSignal.Raise(
            cycle.TenantId, cycle.Id, plan.Id, setbackObjective.Id, EmployeeId,
            setbackObjective.Title, "Sami Analyst",
            "The reopened reviews put this at risk — I'd like to align on scope.",
            lockDate.AddDays(86));

        // 2. The reviewer plans a check-in that links the objective and picks up the open signal.
        var checkIn = PerformanceCheckIn.Plan(
            cycle.TenantId, cycle.Id, EmployeeId, ManagerId, "Flit Manager", "Approver",
            lockDate.AddDays(90), "10:30", "Realign on the control-review setback",
            "Review reopened items and agree on a recovery plan.", lockDate.AddDays(87));
        checkIn.AddLinkedObjective(setbackObjective.Id, setbackObjective.Title);
        signal.LinkToCheckIn(checkIn.Id);

        // 3. The reviewer completes it with a shared summary and two agreed follow-up actions.
        checkIn.Complete(
            "We agreed the two reopened reviews slipped due to audit findings, not delivery. "
            + "Sami will re-plan the remaining reviews; I will secure an extra reviewer for two weeks.",
            [new CheckInDiscussedObjective(setbackObjective.Id, setbackObjective.Title)],
            ManagerId, "Flit Manager", lockDate.AddDays(92));

        var employeeAction = CheckInFollowUpAction.Create(
            cycle.TenantId, cycle.Id, checkIn.Id, EmployeeId,
            "Re-sequence the remaining control reviews and share the updated plan.",
            FollowUpActionOwnerKind.Employee, EmployeeId, "Sami Analyst",
            lockDate.AddDays(100), setbackObjective.Id, lockDate.AddDays(92));
        var reviewerAction = CheckInFollowUpAction.Create(
            cycle.TenantId, cycle.Id, checkIn.Id, EmployeeId,
            "Secure an additional reviewer for two weeks.",
            FollowUpActionOwnerKind.Reviewer, ManagerId, "Flit Manager",
            lockDate.AddDays(105), setbackObjective.Id, lockDate.AddDays(92));

        // 4. Completing the check-in resolves the linked discussion signal.
        signal.ResolveByCheckIn(checkIn.Id, lockDate.AddDays(92));

        // 5. The employee posts their single, immutable response, then completes their own action.
        checkIn.AddEmployeeResponse(EmployeeId, "Sami Analyst",
            "Thanks — recovery plan makes sense. I'll have the re-sequenced schedule out this week.",
            lockDate.AddDays(93));
        employeeAction.Complete(EmployeeId, "Sami Analyst",
            "Updated schedule shared with the team.", lockDate.AddDays(98));

        db.ObjectiveDiscussionSignals.Add(signal);
        db.PerformanceCheckIns.Add(checkIn);
        db.CheckInFollowUpActions.AddRange(employeeAction, reviewerAction);
    }

    private static void AddProgress(PerformanceDbContext db, ObjectiveProgressRecordResult result)
    {
        if (!result.Succeeded || result.Update is null)
            throw new InvalidOperationException("The declarative Atlas progress history is invalid.");
        db.ObjectiveProgressUpdates.Add(result.Update);
    }
}

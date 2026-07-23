using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.ConfigurationAudit;
using EY.HRPlatform.Performance.Features.Evaluations.Configuration.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Evaluations.Configuration.Commands;

public sealed record CreateEvaluationTemplateCommand(
    ClaimsPrincipal Actor,
    string Name,
    string? Purpose,
    string? ParticipantInstructions,
    IReadOnlyList<EvaluationTemplateSectionInput> Sections)
    : ICommand<Result<EvaluationTemplateDto>>;

public sealed record UpdateEvaluationTemplateCommand(
    ClaimsPrincipal Actor,
    Guid TemplateId,
    string Name,
    string? Purpose,
    string? ParticipantInstructions,
    IReadOnlyList<EvaluationTemplateSectionInput> Sections)
    : ICommand<Result<EvaluationTemplateDto>>;

public sealed record SetEvaluationTemplateStatusCommand(
    ClaimsPrincipal Actor,
    Guid TemplateId,
    EvaluationConfigStatus TargetStatus)
    : ICommand<Result<EvaluationTemplateDto>>;

public sealed record DuplicateEvaluationTemplateCommand(
    ClaimsPrincipal Actor,
    Guid TemplateId,
    string Name)
    : ICommand<Result<EvaluationTemplateDto>>;

public sealed class CreateEvaluationTemplateCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<CreateEvaluationTemplateCommand, Result<EvaluationTemplateDto>>
{
    public async Task<Result<EvaluationTemplateDto>> Handle(
        CreateEvaluationTemplateCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(command.Actor))
            return EvaluationConfigurationErrors.Forbidden<EvaluationTemplateDto>();

        try
        {
            var template = EvaluationTemplate.CreateDraft(
                tenant.TenantId, command.Name, command.Purpose, command.ParticipantInstructions);
            AddStructure(template, command.Sections);
            db.EvaluationTemplates.Add(template);
            await EvaluationConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "EvaluationTemplateCreated",
                nameof(EvaluationTemplate), template.Id, newValue: template.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return EvaluationConfigurationMapper.ToDto(template);
        }
        catch (Exception ex) when (EvaluationConfigurationErrors.IsUserCorrectable(ex))
        {
            return EvaluationConfigurationErrors.Invalid<EvaluationTemplateDto>(ex);
        }
    }

    private static void AddStructure(
        EvaluationTemplate template,
        IReadOnlyList<EvaluationTemplateSectionInput> sections)
    {
        foreach (var input in sections)
        {
            var section = template.AddSection(new EvaluationTemplateSectionDraft(
                input.Type, input.Title, input.Guidance));
            foreach (var question in input.Questions)
                template.AddQuestion(section.Id, ToDraft(question));
        }
    }

    internal static EvaluationTemplateQuestionDraft ToDraft(EvaluationTemplateQuestionInput question) => new(
        question.Prompt,
        question.Type,
        question.IsRequired,
        question.TargetRater,
        question.AllowNotApplicable);
}

public sealed class UpdateEvaluationTemplateCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<UpdateEvaluationTemplateCommand, Result<EvaluationTemplateDto>>
{
    public async Task<Result<EvaluationTemplateDto>> Handle(
        UpdateEvaluationTemplateCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(command.Actor))
            return EvaluationConfigurationErrors.Forbidden<EvaluationTemplateDto>();

        var template = await db.EvaluationTemplates
            .Include(item => item.Sections)
            .Include(item => item.Questions)
            .SingleOrDefaultAsync(item => item.Id == command.TemplateId, cancellationToken);
        if (template is null)
            return Result.Failure<EvaluationTemplateDto>(Error.NotFound("EvaluationTemplate", command.TemplateId));

        try
        {
            template.UpdateDetails(command.Name, command.Purpose, command.ParticipantInstructions);
            SynchronizeStructure(template, command.Sections);
            await EvaluationConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "EvaluationTemplateUpdated",
                nameof(EvaluationTemplate), template.Id, newValue: template.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return EvaluationConfigurationMapper.ToDto(template);
        }
        catch (Exception ex) when (EvaluationConfigurationErrors.IsUserCorrectable(ex))
        {
            return EvaluationConfigurationErrors.Invalid<EvaluationTemplateDto>(ex);
        }
    }

    private static void SynchronizeStructure(
        EvaluationTemplate template,
        IReadOnlyList<EvaluationTemplateSectionInput> requested)
    {
        if (requested is null)
            throw new DomainRuleViolationException("Template sections are required.");

        var existingSections = template.Sections.ToDictionary(section => section.Id);
        var requestedSectionIds = requested.Where(section => section.Id.HasValue).Select(section => section.Id!.Value).ToArray();
        if (requestedSectionIds.Length != requestedSectionIds.Distinct().Count() ||
            requestedSectionIds.Any(id => !existingSections.ContainsKey(id)))
            throw new DomainRuleViolationException("Every supplied section must belong to this template exactly once.");

        foreach (var removedId in existingSections.Keys.Where(id => !requestedSectionIds.Contains(id)).ToArray())
            template.RemoveSection(removedId);

        var sectionIds = new Guid[requested.Count];
        for (var sectionIndex = 0; sectionIndex < requested.Count; sectionIndex++)
        {
            var input = requested[sectionIndex];
            if (input.Id.HasValue)
            {
                var existing = existingSections[input.Id.Value];
                if (existing.Type != input.Type)
                    throw new DomainRuleViolationException("A section type cannot be changed; add a new section instead.");
                template.UpdateSection(existing.Id, input.Title, input.Guidance);
                sectionIds[sectionIndex] = existing.Id;
            }
            else
            {
                sectionIds[sectionIndex] = template.AddSection(new EvaluationTemplateSectionDraft(
                    input.Type, input.Title, input.Guidance)).Id;
            }
        }
        template.ReorderSections(sectionIds);

        for (var sectionIndex = 0; sectionIndex < requested.Count; sectionIndex++)
            SynchronizeQuestions(template, sectionIds[sectionIndex], requested[sectionIndex].Questions);
    }

    private static void SynchronizeQuestions(
        EvaluationTemplate template,
        Guid sectionId,
        IReadOnlyList<EvaluationTemplateQuestionInput> requested)
    {
        var existing = template.Questions
            .Where(question => question.SectionId == sectionId)
            .ToDictionary(question => question.Id);
        var requestedIds = requested.Where(question => question.Id.HasValue).Select(question => question.Id!.Value).ToArray();
        if (requestedIds.Length != requestedIds.Distinct().Count() || requestedIds.Any(id => !existing.ContainsKey(id)))
            throw new DomainRuleViolationException("Every supplied question must belong to its section exactly once.");

        foreach (var removedId in existing.Keys.Where(id => !requestedIds.Contains(id)).ToArray())
            template.RemoveQuestion(removedId);

        var questionIds = new Guid[requested.Count];
        for (var questionIndex = 0; questionIndex < requested.Count; questionIndex++)
        {
            var input = requested[questionIndex];
            if (input.Id.HasValue)
            {
                template.UpdateQuestion(input.Id.Value, CreateEvaluationTemplateCommandHandler.ToDraft(input));
                questionIds[questionIndex] = input.Id.Value;
            }
            else
            {
                questionIds[questionIndex] = template.AddQuestion(
                    sectionId,
                    CreateEvaluationTemplateCommandHandler.ToDraft(input)).Id;
            }
        }
        template.ReorderQuestions(sectionId, questionIds);
    }
}

public sealed class SetEvaluationTemplateStatusCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<SetEvaluationTemplateStatusCommand, Result<EvaluationTemplateDto>>
{
    public async Task<Result<EvaluationTemplateDto>> Handle(
        SetEvaluationTemplateStatusCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(command.Actor))
            return EvaluationConfigurationErrors.Forbidden<EvaluationTemplateDto>();

        var template = await db.EvaluationTemplates
            .Include(item => item.Sections)
            .Include(item => item.Questions)
            .SingleOrDefaultAsync(item => item.Id == command.TemplateId, cancellationToken);
        if (template is null)
            return Result.Failure<EvaluationTemplateDto>(Error.NotFound("EvaluationTemplate", command.TemplateId));

        try
        {
            if (command.TargetStatus == EvaluationConfigStatus.Active)
                template.Activate();
            else if (command.TargetStatus == EvaluationConfigStatus.Archived)
                template.Archive();
            else
                throw new DomainRuleViolationException("A template can only be activated or archived.");

            await EvaluationConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, $"EvaluationTemplate{command.TargetStatus}",
                nameof(EvaluationTemplate), template.Id, newValue: command.TargetStatus.ToString(),
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return EvaluationConfigurationMapper.ToDto(template);
        }
        catch (DbUpdateException)
        {
            return Result.Failure<EvaluationTemplateDto>(Error.Conflict(
                "EvaluationTemplate.ActiveNameConflict",
                "An active evaluation template with this name already exists."));
        }
        catch (Exception ex) when (EvaluationConfigurationErrors.IsUserCorrectable(ex))
        {
            return EvaluationConfigurationErrors.Invalid<EvaluationTemplateDto>(ex);
        }
    }
}

public sealed class DuplicateEvaluationTemplateCommandHandler(
    PerformanceDbContext db,
    ITenantContext tenant,
    IPerformanceAccessPolicyService access,
    IConfigurationAuditWriter audit)
    : ICommandHandler<DuplicateEvaluationTemplateCommand, Result<EvaluationTemplateDto>>
{
    public async Task<Result<EvaluationTemplateDto>> Handle(
        DuplicateEvaluationTemplateCommand command,
        CancellationToken cancellationToken)
    {
        if (!access.CanManageEvaluations(command.Actor))
            return EvaluationConfigurationErrors.Forbidden<EvaluationTemplateDto>();

        var source = await db.EvaluationTemplates
            .AsNoTracking()
            .Include(item => item.Sections)
            .Include(item => item.Questions)
            .SingleOrDefaultAsync(item => item.Id == command.TemplateId, cancellationToken);
        if (source is null)
            return Result.Failure<EvaluationTemplateDto>(Error.NotFound("EvaluationTemplate", command.TemplateId));

        try
        {
            var copy = source.Duplicate(command.Name);
            db.EvaluationTemplates.Add(copy);
            await EvaluationConfigurationAudit.AppendAsync(
                audit, tenant.TenantId, command.Actor, "EvaluationTemplateDuplicated",
                nameof(EvaluationTemplate), copy.Id, previousValue: source.Id.ToString(), newValue: copy.Name,
                cancellationToken: cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return EvaluationConfigurationMapper.ToDto(copy);
        }
        catch (Exception ex) when (EvaluationConfigurationErrors.IsUserCorrectable(ex))
        {
            return EvaluationConfigurationErrors.Invalid<EvaluationTemplateDto>(ex);
        }
    }
}

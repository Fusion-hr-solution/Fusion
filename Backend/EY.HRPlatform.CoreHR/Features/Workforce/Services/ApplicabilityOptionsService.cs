using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.CoreHR.Features.Workforce.Dtos;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Workforce.Services;

public interface IApplicabilityOptionsService
{
    Task<ApplicabilityOptionsDto> GetAsync(CancellationToken cancellationToken);
}

public sealed class ApplicabilityOptionsService(CoreHRDbContext db) : IApplicabilityOptionsService
{
    public async Task<ApplicabilityOptionsDto> GetAsync(CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;

        var orgUnits = await db.OrgUnits
            .AsNoTracking()
            .Where(o => o.IsActive)
            .OrderBy(o => o.Name)
            .Select(o => new ApplicabilityOrgUnitDto(o.Id, o.Name, o.Code, o.ParentId))
            .ToListAsync(cancellationToken);

        var jobTitles = await db.WorkAssignments
            .AsNoTracking()
            .Where(w => w.IsPrimary
                && w.EffectiveFrom <= today
                && (w.EffectiveTo == null || today < w.EffectiveTo))
            .Select(w => w.JobTitle)
            .Distinct()
            .OrderBy(t => t)
            .ToListAsync(cancellationToken);

        var workLocations = await db.WorkAssignments
            .AsNoTracking()
            .Where(w => w.IsPrimary
                && w.WorkLocation != null
                && w.EffectiveFrom <= today
                && (w.EffectiveTo == null || today < w.EffectiveTo))
            .Select(w => w.WorkLocation!)
            .Distinct()
            .OrderBy(l => l)
            .ToListAsync(cancellationToken);

        var employmentTypes = await db.Employments
            .AsNoTracking()
            .Where(e => e.Status == EmploymentStatus.Active
                && e.EffectiveTo == null
                && e.EmploymentType != null)
            .Select(e => e.EmploymentType!)
            .Distinct()
            .OrderBy(t => t)
            .ToListAsync(cancellationToken);

        return new ApplicabilityOptionsDto(orgUnits, jobTitles, workLocations, employmentTypes);
    }
}

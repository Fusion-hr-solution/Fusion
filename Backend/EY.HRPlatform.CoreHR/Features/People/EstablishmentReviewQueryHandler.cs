using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.People;

public sealed class EstablishmentReviewQueryHandler(CoreHRDbContext dbContext)
    : IQueryHandler<EstablishmentReviewQuery, Result<EstablishmentReviewDto>>
{
    public async Task<Result<EstablishmentReviewDto>> Handle(
        EstablishmentReviewQuery query,
        CancellationToken cancellationToken)
    {
        var request = query.Request;
        EstablishmentConflictDto? conflict = null;
        if (request.EmployeeNumberMode == EmployeeNumberMode.Manual
            && !string.IsNullOrWhiteSpace(request.EmployeeNumber))
        {
            var number = request.EmployeeNumber.Trim().ToUpperInvariant();
            conflict = await dbContext.Employees.AsNoTracking()
                .Where(employee => employee.EmployeeNumber == number)
                .Select(employee => new EstablishmentConflictDto(
                    "EmployeeNumber",
                    employee.StableEmployeeKey,
                    employee.EmployeeNumber,
                    (employee.PreferredName ?? employee.FirstName) + " " + employee.LastName,
                    $"Employee Number {number} already belongs to this employee."))
                .FirstOrDefaultAsync(cancellationToken);
        }

        var email = string.IsNullOrWhiteSpace(request.WorkEmail)
            ? null
            : request.WorkEmail.Trim().ToLowerInvariant();
        if (conflict is null && email is not null)
        {
            conflict = await (
                from occupancy in dbContext.WorkEmailOccupancies.AsNoTracking()
                join employee in dbContext.Employees.AsNoTracking()
                    on occupancy.EmployeeId equals employee.Id
                where occupancy.NormalizedEmail == email
                select new EstablishmentConflictDto(
                    "WorkEmail",
                    employee.StableEmployeeKey,
                    employee.EmployeeNumber,
                    (employee.PreferredName ?? employee.FirstName) + " " + employee.LastName,
                    "That work email is already used by an active or scheduled employee."))
                .FirstOrDefaultAsync(cancellationToken);
        }

        var first = request.FirstName.Trim().ToLowerInvariant();
        var last = request.LastName.Trim().ToLowerInvariant();
        var conflictKey = conflict?.EmployeeKey;
        var suggestions = await dbContext.Employees.AsNoTracking()
            .Where(employee => employee.StableEmployeeKey != conflictKey
                && ((employee.FirstName.ToLower() == first && employee.LastName.ToLower() == last)
                    || (email != null && employee.Email == email)))
            .OrderBy(employee => employee.LastName)
            .ThenBy(employee => employee.FirstName)
            .Take(3)
            .Select(employee => new EstablishmentSuggestionDto(
                employee.StableEmployeeKey,
                employee.EmployeeNumber,
                (employee.PreferredName ?? employee.FirstName) + " " + employee.LastName,
                email != null && employee.Email == email ? "Same work email" : "Same name"))
            .ToListAsync(cancellationToken);

        return Result.Success(new EstablishmentReviewDto(conflict, suggestions));
    }
}

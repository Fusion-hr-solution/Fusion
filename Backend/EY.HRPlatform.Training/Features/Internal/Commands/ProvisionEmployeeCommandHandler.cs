using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Entities;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Internal.Commands;

public class ProvisionEmployeeCommandHandler : ICommandHandler<ProvisionEmployeeCommand, Result>
{
    private readonly TrainingDbContext _db;

    public ProvisionEmployeeCommandHandler(TrainingDbContext db) => _db = db;

    public async Task<Result> Handle(ProvisionEmployeeCommand request, CancellationToken cancellationToken)
    {
        var existing = await _db.EmployeeProfiles
            .FirstOrDefaultAsync(p => p.EmployeeId == request.EmployeeId, cancellationToken);

        if (existing is not null)
        {
            // Refresh the identity snapshot. Incoming nulls never overwrite an existing value.
            existing.SetIdentity(request.FullName ?? existing.FullName, request.Email ?? existing.Email);
            await _db.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }

        _db.EmployeeProfiles.Add(new EmployeeProfile(
            request.EmployeeId, gradeId: null, serviceLineId: null, fullName: request.FullName, email: request.Email));

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Concurrent provision — if the other request inserted the profile, refresh and succeed.
            var concurrent = await _db.EmployeeProfiles
                .FirstOrDefaultAsync(p => p.EmployeeId == request.EmployeeId, cancellationToken);

            if (concurrent is null)
                throw;

            concurrent.SetIdentity(request.FullName ?? concurrent.FullName, request.Email ?? concurrent.Email);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return Result.Success();
    }
}

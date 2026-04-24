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
        var exists = await _db.EmployeeProfiles
            .AnyAsync(p => p.EmployeeId == request.EmployeeId, cancellationToken);

        if (exists)
            return Result.Success(); // already provisioned — idempotent

        _db.EmployeeProfiles.Add(new EmployeeProfile(request.EmployeeId, gradeId: null, serviceLineId: null));

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Concurrent provision — check if profile was inserted by the other request
            var alreadyProvisioned = await _db.EmployeeProfiles
                .AnyAsync(p => p.EmployeeId == request.EmployeeId, cancellationToken);

            if (alreadyProvisioned)
                return Result.Success();

            throw;
        }

        return Result.Success();
    }
}

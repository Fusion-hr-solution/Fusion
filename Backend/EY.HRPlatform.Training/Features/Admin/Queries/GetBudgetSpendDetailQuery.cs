using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Domain.Enums;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using EY.HRPlatform.Training.Models.Responses;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Admin.Queries;

public record GetBudgetSpendDetailQuery(Guid ServiceLineId, DateTime? From, DateTime? To)
    : IQuery<Result<BudgetSpendDetailDto>>;

public class GetBudgetSpendDetailQueryHandler
    : IQueryHandler<GetBudgetSpendDetailQuery, Result<BudgetSpendDetailDto>>
{
    private readonly TrainingDbContext _db;

    public GetBudgetSpendDetailQueryHandler(TrainingDbContext db) => _db = db;

    public async Task<Result<BudgetSpendDetailDto>> Handle(
        GetBudgetSpendDetailQuery request, CancellationToken cancellationToken)
    {
        var rows = await _db.TrainingSessions
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(s => s.Status != SessionStatus.Cancelled
                && s.Part.Training.CostType == CostType.External
                && s.Part.Training.SponsoringServiceLineId == request.ServiceLineId
                && (request.From == null || s.StartUtc >= request.From.Value)
                && (request.To == null || s.StartUtc < request.To.Value))
            .OrderByDescending(s => s.StartUtc)
            .Select(s => new BudgetSpendDetailRowDto
            {
                SessionId = s.Id,
                TrainingId = s.Part.TrainingId,
                TrainingTitle = s.Part.Training.Title,
                StartUtc = s.StartUtc,
                Amount = (s.ExternalTrainerCost ?? 0m) + (s.VenueCost ?? 0m)
                       + (s.MaterialsCost ?? 0m) + (s.OtherCost ?? 0m),
                TrainerName = s.TrainerName,
            })
            .ToListAsync(cancellationToken);

        var serviceLineName = await _db.ServiceLines
            .AsNoTracking()
            .Where(s => s.Id == request.ServiceLineId)
            .Select(s => s.Name)
            .FirstOrDefaultAsync(cancellationToken) ?? "Unknown";

        return Result.Success(new BudgetSpendDetailDto
        {
            ServiceLineId = request.ServiceLineId,
            ServiceLineName = serviceLineName,
            Rows = rows,
        });
    }
}

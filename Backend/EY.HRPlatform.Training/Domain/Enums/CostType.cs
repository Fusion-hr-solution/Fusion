namespace EY.HRPlatform.Training.Domain.Enums;

/// <summary>
/// Cost origin of a training. Meaningful only for OnSite trainings: External trainings
/// (delivered by a hired external trainer) carry costs; Internal trainings are free.
/// </summary>
public enum CostType
{
    Internal,
    External
}

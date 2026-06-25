using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A structured fiscal/calendar period used to scope strategic objectives (D-02).
/// Represents a stable period identity with display label, start/end dates, fiscal year,
/// and optional granularity (Annual / H1 / H2 / Quarter / Custom).
/// </summary>
public sealed class StrategicPeriod : AggregateRoot, ITenantEntity
{
    private StrategicPeriod() { }

    public Guid TenantId { get; private set; }
    public uint Version { get; private set; }
    public string Label { get; private set; } = string.Empty;
    public int FiscalYear { get; private set; }
    public PeriodGranularity Granularity { get; private set; }
    public DateTime StartDate { get; private set; }
    public DateTime EndDate { get; private set; }
    public bool IsActive { get; private set; }

    public static StrategicPeriod Create(
        Guid tenantId,
        string label,
        int fiscalYear,
        PeriodGranularity granularity,
        DateTime startDate,
        DateTime endDate,
        bool isActive = true)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(label))
            throw new ArgumentException("Period label is required.", nameof(label));
        if (fiscalYear < 2000 || fiscalYear > 2200)
            throw new ArgumentOutOfRangeException(nameof(fiscalYear), "Fiscal year must be between 2000 and 2200.");

        var normalizedStart = NormalizeUtc(startDate, nameof(startDate));
        var normalizedEnd = NormalizeUtc(endDate, nameof(endDate));

        if (normalizedEnd <= normalizedStart)
            throw new ArgumentException("End date must be after start date.");

        return new StrategicPeriod
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Label = label.Trim()[..Math.Min(label.Trim().Length, 100)],
            FiscalYear = fiscalYear,
            Granularity = granularity,
            StartDate = normalizedStart,
            EndDate = normalizedEnd,
            IsActive = isActive,
        };
    }

    private static DateTime NormalizeUtc(DateTime value, string parameterName)
    {
        if (value == default) throw new ArgumentException("A valid date is required.", parameterName);
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };
    }
}

using EY.HRPlatform.Performance.Domain.Common;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Performance.Features.Failures;

public static class VersionGuard
{
    public static Error? Check(PerformanceAggregate root, uint expectedVersion)
        => root.Version == expectedVersion ? null : PerformanceErrors.Changed();
}

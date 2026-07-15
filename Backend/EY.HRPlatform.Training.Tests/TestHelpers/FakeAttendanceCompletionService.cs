using EY.HRPlatform.Training.Features.Enrollment.Services;

namespace EY.HRPlatform.Training.Tests.TestHelpers;

/// <summary>No-op stub — tests that don't exercise ADR-0005 on-site completion just need a valid instance.</summary>
public sealed class FakeAttendanceCompletionService : IAttendanceCompletionService
{
    public Task TryCompleteOnSiteTrainingAsync(
        Guid employeeId, Guid trainingId, Guid justAttendedSessionId, CancellationToken cancellationToken)
        => Task.CompletedTask;
}

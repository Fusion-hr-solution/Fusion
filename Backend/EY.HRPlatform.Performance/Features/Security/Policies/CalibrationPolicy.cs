using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Reviews;

namespace EY.HRPlatform.Performance.Features.Security.Policies;

/// <summary>Calibration authority combines the permission grant, the named facilitator seat and session state.</summary>
public static class CalibrationPolicy
{
    public static bool CanListRounds(bool hasGrant) => hasGrant;
    public static bool CanListFacilitatorCandidates(bool hasGrant) => hasGrant;
    public static bool CanOpen(bool hasGrant) => hasGrant;

    public static bool CanView(bool hasGrant, CalibrationSession session, Guid userId)
        => hasGrant && userId != Guid.Empty && session.IsFacilitator(userId);

    public static bool CanAdjust(bool hasGrant, CalibrationSession session, Guid userId)
        => CanView(hasGrant, session, userId) && session.State == CalibrationSessionState.Open;

    public static bool CanFinalize(bool hasGrant, CalibrationSession session, Guid userId)
        => CanView(hasGrant, session, userId)
            && session.State is CalibrationSessionState.Open or CalibrationSessionState.Finalized;
}

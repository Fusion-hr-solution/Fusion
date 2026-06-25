namespace EY.HRPlatform.CoreHR.Domain.Enums;

/// <summary>
/// The business context of a reporting relationship. Only PrimaryManager participates
/// in the canonical management chain used by downstream workflow modules.
/// </summary>
public enum ReportingRelationshipType
{
    PrimaryManager,
    SecondaryManager,
    MatrixManager,
    MissionManager,
    ProjectManager,
    TemporaryManager
}

namespace EY.HRPlatform.CoreHR.Domain.Enums;

/// <summary>
/// Provenance of a canonical workforce fact. Recorded on each <c>Employment</c>,
/// <c>WorkAssignment</c>, and <c>ManagerRelationship</c> so the origin of every fact is
/// defensible. <see cref="Migration"/> marks rows created by the one-time backfill.
/// </summary>
public enum WorkforceSourceType
{
    Manual,
    Import,
    Migration
}

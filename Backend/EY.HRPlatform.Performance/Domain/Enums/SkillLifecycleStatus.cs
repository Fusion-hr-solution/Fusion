namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Lifecycle state for tenant-owned skills catalogue entities that have no
/// structural draft stage (skill categories and skills). Active or Archived only.
/// </summary>
public enum SkillLifecycleStatus
{
    Active,
    Archived
}

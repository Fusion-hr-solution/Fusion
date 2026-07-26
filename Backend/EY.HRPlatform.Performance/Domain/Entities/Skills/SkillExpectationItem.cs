using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities.Skills;

/// <summary>
/// One expected proficiency for a skill within an expectation set. The expected
/// level is stored as a proficiency-scale ordinal — never a performance rating.
/// No weight is ever carried here.
/// </summary>
public sealed class SkillExpectationItem : BaseEntity, ITenantEntity
{
    private SkillExpectationItem() { }

    public Guid TenantId { get; private set; }
    public Guid ExpectationSetId { get; private set; }
    public Guid SkillId { get; private set; }
    public int ExpectedLevelOrdinal { get; private set; }

    internal static SkillExpectationItem Create(
        Guid tenantId,
        Guid expectationSetId,
        Guid skillId,
        int expectedLevelOrdinal)
    {
        if (skillId == Guid.Empty)
            throw new DomainRuleViolationException("An expectation item requires a skill.");

        return new SkillExpectationItem
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ExpectationSetId = expectationSetId,
            SkillId = skillId,
            ExpectedLevelOrdinal = expectedLevelOrdinal
        };
    }

    internal void SetExpectedLevel(int expectedLevelOrdinal)
    {
        ExpectedLevelOrdinal = expectedLevelOrdinal;
        UpdatedAt = DateTime.UtcNow;
    }
}

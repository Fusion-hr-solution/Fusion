namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>Whether a responsibility was suggested from Core context or explicitly curated.</summary>
public enum CampaignAssignmentSource
{
    Generated,
    Curated,
    Delegated,
    ExceptionRouted
}

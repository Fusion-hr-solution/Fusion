namespace EY.HRPlatform.Training.Domain.Enums;

/// <summary>Which calendar sync adapter delivers session invites. iMIP (email) is the default.</summary>
public enum CalendarProvider
{
    Imip,
    Graph,
    None,
}

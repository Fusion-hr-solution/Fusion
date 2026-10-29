namespace EY.HRPlatform.Identity.Models.Requests;

/// <summary>Either choice may be left out to keep it; at least one must be given.</summary>
public class SetAccountAlertsRequest
{
    public bool? Popups { get; set; }
    public bool? Sound { get; set; }
}

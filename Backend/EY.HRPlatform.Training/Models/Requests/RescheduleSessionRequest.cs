namespace EY.HRPlatform.Training.Models.Requests;

/// <summary>Body for PATCH /admin/sessions/{id}/schedule — a drag/drop reschedule.</summary>
public class RescheduleSessionRequest
{
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
}

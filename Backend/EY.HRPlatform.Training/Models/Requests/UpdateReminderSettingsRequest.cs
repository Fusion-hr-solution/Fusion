namespace EY.HRPlatform.Training.Models.Requests;

public class UpdateReminderSettingsRequest
{
    public bool Enabled { get; set; }
    public List<int> OffsetsMinutes { get; set; } = new();
}

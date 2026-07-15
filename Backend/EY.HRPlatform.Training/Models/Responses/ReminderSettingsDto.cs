namespace EY.HRPlatform.Training.Models.Responses;

public class ReminderSettingsDto
{
    public bool Enabled { get; set; }
    public List<int> OffsetsMinutes { get; set; } = new();
}

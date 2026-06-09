namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>
/// Current QR payload + rotation metadata for a session attendance token.
/// The frontend should re-fetch at <see cref="RefreshAt"/> (next window boundary).
/// </summary>
public class SessionQrCodeDto
{
    public Guid SessionId { get; set; }
    public string Payload { get; set; } = string.Empty;
    public int RotationSeconds { get; set; }
    public DateTime IssuedAt { get; set; }
    public DateTime RefreshAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; }
}

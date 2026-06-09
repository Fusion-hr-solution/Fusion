namespace EY.HRPlatform.Training.Models.Requests;

public class GenerateSessionQrCodeRequest
{
    /// <summary>If true, rotates the secret (invalidates all previously captured QR images).</summary>
    public bool Regenerate { get; set; }
}

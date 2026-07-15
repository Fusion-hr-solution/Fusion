namespace EY.HRPlatform.Training.Infrastructure.Services;

public sealed class BudgetAlertEmailOptions
{
    public const string SectionName = "Email:BudgetAlerts";

    public bool Enabled { get; set; }
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool UseSsl { get; set; } = true;
    public string FromEmail { get; set; } = "no-reply@example.com";
    public string FromName { get; set; } = "Fusion HR";
    public string? ReplyToEmail { get; set; }

    /// <summary>Fixed To-address that receives budget threshold alerts (the budget administrator).</summary>
    public string AdminRecipientEmail { get; set; } = string.Empty;

    public string Subject { get; set; } = "Training budget threshold alert";
    public bool UseHtmlBody { get; set; } = true;
}

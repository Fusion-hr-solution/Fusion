namespace EY.HRPlatform.Performance.Infrastructure.Attachments;

/// <summary>Configuration for attachment storage and validation (bound from the "Attachments" section).</summary>
public sealed class AttachmentOptions
{
    public const string SectionName = "Attachments";

    /// <summary>Master switch: when false, uploads are rejected.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Filesystem root under which tenant-partitioned attachment bytes are written.</summary>
    public string StorageRoot { get; set; } = "attachments";

    public long MaxSizeBytes { get; set; } = 10 * 1024 * 1024; // 10 MB

    /// <summary>
    /// Where attachment bytes live: <c>FileSystem</c> (the local-development default) or
    /// <c>Database</c>, which lets any replica read any attachment (design D11).
    /// </summary>
    public AttachmentStorageBackend StorageBackend { get; set; } = AttachmentStorageBackend.FileSystem;

    /// <summary>Allowed content types. Empty means "allow any".</summary>
    public string[] AllowedContentTypes { get; set; } =
    [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/gif",
        "text/plain",
        "text/csv",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    /// <summary>Age after which a still-pending (uncommitted) attachment is reaped by the cleanup sweep.</summary>
    public int AbandonmentAgeHours { get; set; } = 24;
}

/// <summary>Selectable attachment byte-store backends.</summary>
public enum AttachmentStorageBackend
{
    /// <summary>Node-local disk. Simple, and pins the module to one replica.</summary>
    FileSystem,

    /// <summary>Postgres `bytea`. Any replica can read any attachment.</summary>
    Database
}

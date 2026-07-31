using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Interview.Models.Candidates;

/// <summary>
/// A batch of client-side proctoring signals for the caller's in-progress attempt, plus an optional
/// heartbeat. Token-gated and anonymous (like start/submit/run): the token identifies the attempt.
/// Detection happens on the device — only this metadata is sent, never frames or images.
/// </summary>
public class SubmitProctoringEventsDto
{
    [Required]
    public string Token { get; set; } = string.Empty;

    /// <summary>Same fingerprint sent on start/submit/run — re-validated against the bound
    /// invitation so a leaked token can't post events from another browser.</summary>
    [MaxLength(1024)]
    public string? BrowserFingerprint { get; set; }

    /// <summary>Set server-side from the connection (not trusted from the client).</summary>
    [MaxLength(64)]
    public string? ClientIpAddress { get; set; }

    /// <summary>Set server-side from the request headers (not trusted from the client).</summary>
    [MaxLength(1024)]
    public string? UserAgent { get; set; }

    /// <summary>When true, refreshes the attempt's proctor heartbeat even if <see cref="Events"/>
    /// is empty — the periodic "still alive" ping.</summary>
    public bool Heartbeat { get; set; }

    /// <summary>The batch. Cap enforced server-side; an empty list is allowed only as a
    /// heartbeat-only ping.</summary>
    [MaxLength(ProctoringIngestLimits.MaxBatchSize)]
    public List<ProctoringEventInputDto> Events { get; set; } = [];
}

public class ProctoringEventInputDto
{
    /// <summary>Client-generated id for at-least-once dedupe; unique per attempt.</summary>
    [Required]
    [MaxLength(64)]
    public string ClientEventId { get; set; } = string.Empty;

    /// <summary>One of the server-validated proctoring types (snake_case).</summary>
    [Required]
    [MaxLength(32)]
    public string Type { get; set; } = string.Empty;

    /// <summary>Detector confidence in [0,1] for model signals; omit for deterministic ones.</summary>
    public double? Confidence { get; set; }

    [MaxLength(ProctoringIngestLimits.MaxDetailLength)]
    public string? Detail { get; set; }

    [Required]
    public DateTime StartedAtUtc { get; set; }

    public DateTime? EndedAtUtc { get; set; }
}

/// <summary>Ingestion outcome: how many rows were newly stored vs. skipped as duplicates, and the
/// server heartbeat timestamp applied to the attempt.</summary>
public class ProctoringIngestResultDto
{
    public int Accepted { get; set; }
    public int Deduplicated { get; set; }
    /// <summary>Events discarded because the layer governing their type is not enabled on the test
    /// (server-side enforcement — the client should not have sent them).</summary>
    public int Dropped { get; set; }
    public string? HeartbeatAtUtc { get; set; }
}

public static class ProctoringIngestLimits
{
    /// <summary>Max events per POST. Keeps a single ~10 s client batch bounded and one bulk insert
    /// small; larger batches are rejected 400 so a client can't dump unbounded rows per call.</summary>
    public const int MaxBatchSize = 100;

    /// <summary>Max length of a single event's Detail blob. Single source for the DTO attribute,
    /// the EF column, and the service-side guard.</summary>
    public const int MaxDetailLength = 512;

    /// <summary>How far a client timestamp may lead the server clock before it's rejected.</summary>
    public static readonly TimeSpan ClockSkew = TimeSpan.FromMinutes(2);
}

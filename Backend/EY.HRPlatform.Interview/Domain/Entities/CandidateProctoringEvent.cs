using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Domain.Entities;

/// <summary>
/// A single proctoring signal captured client-side during an attempt. <b>Metadata only</b> — no
/// frames, images, or biometric templates ever leave the device, and deliberately no
/// IP/fingerprint/UA here (the parent attempt already holds those). So these rows carry no direct
/// identifiers: anonymization needs no field-scrubbing here, only deletion paths matter.
/// </summary>
public class CandidateProctoringEvent : AggregateRoot
{
    public Guid AttemptId { get; set; }

    /// <summary>One of <see cref="Domain.ProctoringEventTypes"/> (validated server-side on ingest).</summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>Detector confidence in [0,1] for model-based signals (Layer A); null for the
    /// deterministic browser signals (tab/fullscreen/clipboard).</summary>
    public double? Confidence { get; set; }

    /// <summary>Optional small context blob, e.g. pasted-text length or detected object label.
    /// Capped in the EF config; never contains frames or PII.</summary>
    public string? Detail { get; set; }

    public DateTime StartedAtUtc { get; set; }

    /// <summary>Set when the signal is a bounded interval (e.g. absence that ended); null for a
    /// point-in-time signal.</summary>
    public DateTime? EndedAtUtc { get; set; }

    /// <summary>Server-authoritative receipt time (never trusted from the client).</summary>
    public DateTime ServerReceivedAtUtc { get; set; }

    /// <summary>Client-generated id enabling at-least-once delivery without duplicates. Unique per
    /// <c>(AttemptId, ClientEventId)</c> so re-sent batches are idempotent.</summary>
    public string ClientEventId { get; set; } = string.Empty;

    public CandidateTestAttempt? Attempt { get; set; }
}

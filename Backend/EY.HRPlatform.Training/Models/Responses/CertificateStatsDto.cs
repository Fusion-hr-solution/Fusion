namespace EY.HRPlatform.Training.Models.Responses;

/// <summary>Aggregate statistics for the admin certificate registry.</summary>
public class CertificateStatsDto
{
    public int Total { get; set; }
    public int ValidCount { get; set; }
    public int RevokedCount { get; set; }

    /// <summary>Issued-certificate counts per formation (descending).</summary>
    public List<CertificateCountByKeyDto> ByTraining { get; set; } = [];

    /// <summary>Issued-certificate counts per calendar month ("yyyy-MM", chronological).</summary>
    public List<CertificateCountByKeyDto> ByMonth { get; set; } = [];
}

public class CertificateCountByKeyDto
{
    public string Key { get; set; } = string.Empty;
    public int Count { get; set; }
}

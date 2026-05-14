using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Admin.Sessions.Export;

/// <summary>
/// Generates participant-list export files (Excel / PDF) for a training session.
/// </summary>
public interface ISessionParticipantExporter
{
    /// <summary>
    /// Build an .xlsx file as a byte array.
    /// </summary>
    byte[] ToExcel(SessionParticipantExportDto data);

    /// <summary>
    /// Build a .pdf file as a byte array.
    /// </summary>
    byte[] ToPdf(SessionParticipantExportDto data);
}

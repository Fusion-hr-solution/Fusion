using EY.HRPlatform.Training.Features.Admin.Sessions.Export;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Tests.Handlers.Admin.Sessions;

public class SessionParticipantExporterTests
{
    private static SessionParticipantExportDto BuildDto() => new()
    {
        SessionId = Guid.NewGuid(),
        TrainingTitle = "Advanced C#",
        PartTitle = "Part 1",
        StartUtc = new DateTime(2025, 6, 15, 9, 0, 0, DateTimeKind.Utc),
        EndUtc = new DateTime(2025, 6, 15, 12, 0, 0, DateTimeKind.Utc),
        Room = "Room A",
        MaxCapacity = 25,
        TrainerName = "Trainer One",
        Participants =
        [
            new SessionParticipantRowDto
            {
                EmployeeId = Guid.NewGuid(),
                FullName = "Alice Doe",
                Email = "alice@ey.com",
                Grade = "Senior",
                ServiceLine = "Consulting",
                EnrollmentDate = DateTime.UtcNow.AddDays(-3),
                AttendanceStatus = "Attended",
            },
            new SessionParticipantRowDto
            {
                EmployeeId = Guid.NewGuid(),
                FullName = "Bob Smith",
                Email = "bob@ey.com",
                Grade = null,
                ServiceLine = null,
                EnrollmentDate = DateTime.UtcNow.AddDays(-1),
                AttendanceStatus = "Enrolled",
            },
        ],
    };

    [Fact]
    public void ToExcel_ReturnsValidXlsxBytes()
    {
        var exporter = new SessionParticipantExporter();
        var bytes = exporter.ToExcel(BuildDto());

        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 0);
        // .xlsx files are zip-archives -> first 2 bytes "PK"
        Assert.Equal((byte)'P', bytes[0]);
        Assert.Equal((byte)'K', bytes[1]);
    }

    [Fact]
    public void ToPdf_ReturnsValidPdfBytes()
    {
        var exporter = new SessionParticipantExporter();
        var bytes = exporter.ToPdf(BuildDto());

        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 0);
        // PDF magic header "%PDF"
        Assert.Equal((byte)'%', bytes[0]);
        Assert.Equal((byte)'P', bytes[1]);
        Assert.Equal((byte)'D', bytes[2]);
        Assert.Equal((byte)'F', bytes[3]);
    }

    [Fact]
    public void ToExcel_HandlesEmptyParticipants()
    {
        var exporter = new SessionParticipantExporter();
        var dto = BuildDto();
        dto.Participants = [];

        var bytes = exporter.ToExcel(dto);

        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 0);
    }

    [Fact]
    public void ToPdf_HandlesEmptyParticipants()
    {
        var exporter = new SessionParticipantExporter();
        var dto = BuildDto();
        dto.Participants = [];

        var bytes = exporter.ToPdf(dto);

        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 0);
    }
}

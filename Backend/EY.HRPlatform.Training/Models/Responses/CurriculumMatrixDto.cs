namespace EY.HRPlatform.Training.Models.Responses;

public class CurriculumMatrixDto
{
    public List<GradeDto> Grades { get; set; } = [];
    public List<ServiceLineDto> ServiceLines { get; set; } = [];
    public List<CurriculumCellDto> Cells { get; set; } = [];
}

public class CurriculumCellDto
{
    public Guid GradeId { get; set; }
    public Guid ServiceLineId { get; set; }
    public int FormationCount { get; set; }
    public int IsRequiredCount { get; set; }
}

using EY.HRPlatform.Interview.Domain.Entities;
using EY.HRPlatform.Interview.Features.Grading.Dtos;

namespace EY.HRPlatform.Interview.Features.Grading.Graders;

public interface IGrader
{
    bool CanGrade(Question question);
    Task<QuestionGradeResultDto> GradeAsync(Question question, string answer, CancellationToken ct);
}

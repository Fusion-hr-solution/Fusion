using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using EY.HRPlatform.Training.Models.Responses;

namespace EY.HRPlatform.Training.Features.Exams.Commands;

public record SubmitExamCommand(
    Guid EmployeeId,
    Guid TrainingId,
    List<SubmitExamAnswer> Answers) : ICommand<Result<ExamSubmissionResultDto>>;

public record SubmitExamAnswer(Guid QuestionId, List<Guid> SelectedOptionIds);

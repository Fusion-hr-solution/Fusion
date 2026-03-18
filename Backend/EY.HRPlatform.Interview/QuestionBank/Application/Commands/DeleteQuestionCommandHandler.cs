using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.Interview.QuestionBank.Infrastructure.Repositories;
using MediatR;

namespace EY.HRPlatform.Interview.QuestionBank.Application.Commands;

public class DeleteQuestionCommandHandler : ICommandHandler<DeleteQuestionCommand>
{
    private readonly IQuestionRepository _repository;

    public DeleteQuestionCommandHandler(IQuestionRepository repository)
    {
        _repository = repository;
    }

    public async Task<Unit> Handle(DeleteQuestionCommand request, CancellationToken cancellationToken)
    {
        await _repository.DeleteAsync(request.Id);
        return Unit.Value;
    }
}
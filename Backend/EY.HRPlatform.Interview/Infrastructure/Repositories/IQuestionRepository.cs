using EY.HRPlatform.Interview.Domain.Entities;

namespace EY.HRPlatform.Interview.Infrastructure.Repositories;

public interface IQuestionRepository
{
    Task<Question?> GetByIdAsync(Guid id);
    Task<(List<Question> Items, long Total)> GetPaginatedAsync(
        int page,
        int pageSize,
        string? search = null,
        string[]? types = null,
        string[]? difficulties = null,
        string? sortBy = null);
    Task<Question> AddAsync(Question question);
    Task<Question> UpdateAsync(Question question);
    Task DeleteAsync(Guid id);
}
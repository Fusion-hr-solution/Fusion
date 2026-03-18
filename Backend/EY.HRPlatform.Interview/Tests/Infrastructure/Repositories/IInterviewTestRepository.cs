using EY.HRPlatform.Interview.Tests.Domain.Entities;

namespace EY.HRPlatform.Interview.Tests.Infrastructure.Repositories;

public interface IInterviewTestRepository
{
    Task<InterviewTest?> GetByIdAsync(Guid id);
    Task<List<InterviewTest>> GetDraftsByUserAsync(Guid userId);
    Task<List<InterviewTest>> GetPublishedAsync();
    Task<InterviewTest> AddAsync(InterviewTest test);
    Task<InterviewTest> UpdateAsync(InterviewTest test);
    Task DeleteAsync(Guid id);
}
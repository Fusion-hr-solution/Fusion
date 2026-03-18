using EY.HRPlatform.Interview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using EY.HRPlatform.Interview.Domain.Entities;

namespace EY.HRPlatform.Interview.Infrastructure.Repositories;

public class InterviewTestRepository : IInterviewTestRepository
{
    private readonly InterviewDbContext _context;

    public InterviewTestRepository(InterviewDbContext context)
    {
        _context = context;
    }

    public async Task<InterviewTest?> GetByIdAsync(Guid id)
    {
        return await _context.InterviewTests
            .Include(t => t.Config)
            .Include(t => t.Questions)
            .FirstOrDefaultAsync(t => t.Id == id && t.IsActive);
    }

    public async Task<List<InterviewTest>> GetDraftsByUserAsync(Guid userId)
    {
        return await _context.InterviewTests
            .Include(t => t.Config)
            .Include(t => t.Questions)
            .Where(t => t.Status == "Draft" && t.IsActive)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<InterviewTest>> GetPublishedAsync()
    {
        return await _context.InterviewTests
            .Include(t => t.Config)
            .Include(t => t.Questions)
            .Where(t => t.Status == "Published" && t.IsActive)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<InterviewTest> AddAsync(InterviewTest test)
    {
        _context.InterviewTests.Add(test);
        await _context.SaveChangesAsync();
        return test;
    }

    public async Task<InterviewTest> UpdateAsync(InterviewTest test)
    {
        _context.InterviewTests.Update(test);
        await _context.SaveChangesAsync();
        return test;
    }

    public async Task DeleteAsync(Guid id)
    {
        var test = await _context.InterviewTests.FindAsync(id);
        if (test != null)
        {
            test.IsActive = false;
            _context.InterviewTests.Update(test);
            await _context.SaveChangesAsync();
        }
    }
}
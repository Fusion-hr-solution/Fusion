using EY.HRPlatform.Interview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using EY.HRPlatform.Interview.Domain.Entities;

namespace EY.HRPlatform.Interview.Infrastructure.Repositories;

public class QuestionRepository : IQuestionRepository
{
    private readonly InterviewDbContext _context;

    public QuestionRepository(InterviewDbContext context)
    {
        _context = context;
    }

    public async Task<Question?> GetByIdAsync(Guid id)
    {
        return await _context.Questions
            .Include(q => q.Options)
            .FirstOrDefaultAsync(q => q.Id == id && q.IsActive);
    }

    public async Task<(List<Question> Items, long Total)> GetPaginatedAsync(
        int page,
        int pageSize,
        string? search = null,
        string[]? types = null,
        string[]? difficulties = null,
        string? sortBy = null)
    {
        var query = _context.Questions
            .Include(q => q.Options)
            .Where(q => q.IsActive)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(q =>
                q.Title.Contains(search) ||
                q.Description.Contains(search) ||
                q.Tags.Any(t => t.Contains(search)));
        }

        if (types?.Length > 0)
            query = query.Where(q => types.Contains(q.Type));

        if (difficulties?.Length > 0)
            query = query.Where(q => difficulties.Contains(q.Difficulty));

        var total = await query.CountAsync();

        query = sortBy?.ToLower() switch
        {
            "title" => query.OrderBy(q => q.Title),
            "difficulty" => query.OrderBy(q => q.Difficulty),
            "points" => query.OrderByDescending(q => q.Points),
            "recent" => query.OrderByDescending(q => q.CreatedAt),
            _ => query.OrderByDescending(q => q.CreatedAt)
        };

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<Question> AddAsync(Question question)
    {
        _context.Questions.Add(question);
        await _context.SaveChangesAsync();
        return question;
    }

    public async Task<Question> UpdateAsync(Question question)
    {
        _context.Questions.Update(question);
        await _context.SaveChangesAsync();
        return question;
    }

    public async Task DeleteAsync(Guid id)
    {
        var question = await _context.Questions.FindAsync(id);
        if (question != null)
        {
            question.IsActive = false;
            _context.Questions.Update(question);
            await _context.SaveChangesAsync();
        }
    }
}
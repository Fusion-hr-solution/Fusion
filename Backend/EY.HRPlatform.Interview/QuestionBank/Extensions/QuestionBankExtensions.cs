using EY.HRPlatform.Interview.Infrastructure.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Interview.QuestionBank.Extensions;

public static class QuestionBankExtensions
{
    public static IServiceCollection AddQuestionBankModule(this IServiceCollection services)
    {
        services.AddScoped<IQuestionRepository, QuestionRepository>();
        return services;
    }
}
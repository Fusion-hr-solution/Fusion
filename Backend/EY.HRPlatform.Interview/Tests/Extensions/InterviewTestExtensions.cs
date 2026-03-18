using EY.HRPlatform.Interview.Infrastructure.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Interview.Tests.Extensions;

public static class InterviewTestsExtensions
{
    public static IServiceCollection AddInterviewTestsModule(this IServiceCollection services)
    {
        services.AddScoped<IInterviewTestRepository, InterviewTestRepository>();
        return services;
    }
}
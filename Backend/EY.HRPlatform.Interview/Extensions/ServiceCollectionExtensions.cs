using System.Text;
using EY.HRPlatform.Interview.Infrastructure.Persistence;
using EY.HRPlatform.Interview.QuestionBank.Extensions;
using EY.HRPlatform.Interview.Tests.Extensions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace EY.HRPlatform.Interview.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInterviewServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // 1. Register PostgreSQL database
        services.AddDbContext<InterviewDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString("InterviewDb"),
                npgsql => npgsql.MigrationsHistoryTable(
                    "__EFMigrationsHistory", "interview")));

        // 2. Register module repositories (no MediatR needed)
        services.AddQuestionBankModule();
        services.AddInterviewTestsModule();

        // 3. Register JWT authentication
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = configuration["Jwt:Issuer"],
                    ValidAudience = configuration["Jwt:Audience"],
                    IssuerSigningKey = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(configuration["Jwt:Secret"]!)),
                    ClockSkew = TimeSpan.Zero
                };
            });

        return services;
    }
}
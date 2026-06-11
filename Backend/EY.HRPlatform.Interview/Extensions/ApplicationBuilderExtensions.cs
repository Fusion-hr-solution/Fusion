using EY.HRPlatform.Interview.Middleware;

namespace EY.HRPlatform.Interview.Extensions;

public static class ApplicationBuilderExtensions
{
    public static WebApplication UseInterviewPipeline(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseMiddleware<ExceptionHandlingMiddleware>();
        if (!app.Environment.IsDevelopment())
        {
            app.UseHttpsRedirection();
        }
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();

        return app;
    }
}

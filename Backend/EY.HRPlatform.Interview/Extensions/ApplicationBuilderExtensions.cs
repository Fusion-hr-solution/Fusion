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
        app.UseHttpsRedirection();
        app.UseAuthorization();
        app.MapControllers();

        return app;
    }
}

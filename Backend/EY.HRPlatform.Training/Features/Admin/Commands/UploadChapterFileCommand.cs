using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.Training.Features.Admin.Commands;

public record UploadChapterFileCommand(IFormFile File) : ICommand<Result<string>>;

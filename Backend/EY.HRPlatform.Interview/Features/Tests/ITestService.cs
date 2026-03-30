using EY.HRPlatform.Interview.Models.Common;
using EY.HRPlatform.Interview.Models.Tests;

namespace EY.HRPlatform.Interview.Features.Tests;

public interface ITestService
{
    Task<PagedResultDto<TestDto>> GetAsync(TestFilterDto filter, CancellationToken cancellationToken);
    Task<TestDto> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<TestDto> CreateAsync(CreateTestDto request, CancellationToken cancellationToken);
    Task<TestDto> UpdateAsync(Guid id, UpdateTestDto request, CancellationToken cancellationToken);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}
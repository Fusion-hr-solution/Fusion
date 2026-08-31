using EY.HRPlatform.Interview.Models.Taxonomy;

namespace EY.HRPlatform.Interview.Features.Taxonomy;

public interface IInterviewTaxonomyService
{
    Task<InterviewTaxonomyDto> GetAsync(CancellationToken cancellationToken);

    /// <summary>Applies a partial update — only the lists present in the request are touched.</summary>
    Task<InterviewTaxonomyDto> SaveAsync(UpdateInterviewTaxonomyDto request, CancellationToken cancellationToken);
}

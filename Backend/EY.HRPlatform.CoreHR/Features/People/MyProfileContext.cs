using EY.HRPlatform.CoreHR.Features.Employees.Services;
using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.People;

/// <summary>
/// The self-service extras for a signed-in worker's own profile: their assignment
/// history (the same canonical Timeline shown to HR) and a lean view of their own
/// Fusion access. Both are derived for the caller's own employee id only — the
/// controller resolves it from the authenticated claims, never from the request.
/// </summary>
public sealed record MyFusionAccessDto(
    string State,
    string Label,
    string? LinkedEmail,
    IReadOnlyList<string> AccessProfiles,
    DateTime? LastSignInAt);

public sealed record MyProfileContextDto(
    PeopleTimelineDto Timeline,
    MyFusionAccessDto? Access);

public sealed record MyProfileContextQuery(Guid EmployeeId)
    : IQuery<Result<MyProfileContextDto>>;

public sealed class MyProfileContextQueryHandler(
    CoreHRDbContext dbContext,
    PeopleTimelineComposer composer,
    IWorkforceAccountStatusReader statusReader)
    : IQueryHandler<MyProfileContextQuery, Result<MyProfileContextDto>>
{
    public async Task<Result<MyProfileContextDto>> Handle(
        MyProfileContextQuery request,
        CancellationToken cancellationToken)
    {
        var employee = await dbContext.Employees.AsNoTracking()
            .Where(item => item.Id == request.EmployeeId)
            .Select(item => new
            {
                item.Id,
                item.StableEmployeeKey,
                item.Email,
                item.FirstName,
                item.LastName
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (employee is null)
            return Result.Failure<MyProfileContextDto>(new Error("Employee.NotFound", "Employee was not found."));

        var timeline = await composer.ComposeAsync(employee.Id, employee.StableEmployeeKey, cancellationToken);

        MyFusionAccessDto? access = null;
        if (!string.IsNullOrWhiteSpace(employee.Email))
        {
            try
            {
                var statuses = await statusReader.GetStatusesAsync(
                    [new WorkforceAccountSubjectDto(employee.Id, employee.Email, employee.FirstName, employee.LastName)],
                    cancellationToken);
                access = ProjectAccess(statuses.GetValueOrDefault(employee.Id), employee.Email);
            }
            catch
            {
                // Identity being unavailable degrades the access card to hidden rather
                // than failing the whole profile load.
                access = null;
            }
        }

        return Result.Success(new MyProfileContextDto(timeline, access));
    }

    private static MyFusionAccessDto ProjectAccess(WorkforceAccountStatusDto? status, string email)
    {
        if (status is null)
            return new MyFusionAccessDto("NoAccess", "No Fusion access", email, Array.Empty<string>(), null);

        var (state, label) = status.ProvisioningState switch
        {
            "Active" => ("Active", "Active"),
            "Inactive" => ("Suspended", "Suspended"),
            "InvitePending" => ("InvitationPending", "Invitation pending"),
            "InviteExpired" or "InviteRevoked" or "InviteAccepted" or "Conflict"
                => ("NeedsReview", "Needs review"),
            _ => ("NoAccess", "No Fusion access"),
        };

        var profiles = status.AccessProfiles.Select(profile => profile.Name).ToList();
        return new MyFusionAccessDto(state, label, status.Email ?? email, profiles, status.LastLoginAt);
    }
}

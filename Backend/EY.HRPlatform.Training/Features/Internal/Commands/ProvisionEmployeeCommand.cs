using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Internal.Commands;

/// <summary>
/// Creates an empty EmployeeProfile for the given employee if one does not already exist.
/// Idempotent: succeeds silently if the profile already exists.
/// Published by the Identity service when a user is assigned the Employee role.
/// </summary>
public record ProvisionEmployeeCommand(Guid EmployeeId) : ICommand<Result>;

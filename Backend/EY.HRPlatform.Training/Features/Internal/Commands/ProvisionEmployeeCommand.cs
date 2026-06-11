using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;

namespace EY.HRPlatform.Training.Features.Internal.Commands;

/// <summary>
/// Upserts the EmployeeProfile for the given employee, refreshing the synced identity snapshot
/// (full name + email). Idempotent: creates the profile if missing, otherwise refreshes it.
/// Published by the Identity service when a user is created or assigned the Employee role.
/// </summary>
public record ProvisionEmployeeCommand(Guid EmployeeId, string? FullName = null, string? Email = null) : ICommand<Result>;

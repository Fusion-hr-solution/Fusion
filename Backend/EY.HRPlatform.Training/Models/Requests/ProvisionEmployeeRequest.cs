namespace EY.HRPlatform.Training.Models.Requests;

/// <summary>Request body for the employee provision endpoint.</summary>
public sealed record ProvisionEmployeeRequest(Guid EmployeeId, string? FullName = null, string? Email = null);

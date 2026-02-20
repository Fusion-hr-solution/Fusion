using System;
using System.Collections.Generic;
using System.Text;

namespace EY.HRPlatform.SharedKernel.Events.IntegrationEvents;

/// <summary>
/// Published by Core Identity when a new employee is registered.
/// Consumed by all modules that need to initialize data for the new employee.
/// </summary>
public record EmployeeCreatedIntegrationEvent(
    Guid EmployeeId,
    string FirstName,
    string LastName,
    string Email,
    string Department,
    string JobTitle,
    DateTime HireDate,
    DateTime PublishedAt
);
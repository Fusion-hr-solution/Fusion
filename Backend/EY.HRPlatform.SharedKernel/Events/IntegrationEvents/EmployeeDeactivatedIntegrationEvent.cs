using System;
using System.Collections.Generic;
using System.Text;

namespace EY.HRPlatform.SharedKernel.Events.IntegrationEvents;

public record EmployeeDeactivatedIntegrationEvent(
    Guid EmployeeId,
    string Reason,
    DateTime DeactivatedAt,
    DateTime PublishedAt
);